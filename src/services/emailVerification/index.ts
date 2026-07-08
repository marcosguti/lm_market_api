import type { OtpCodePurpose, User } from '@prisma/client';

import { randomInt } from 'node:crypto';

import { comparePassword, createHash } from '../../libs/passwordHashing.js';
import { sendEmailVerificationCode, sendLoginCode } from '../../libs/sendEmail/index.js';
import prisma from '../../prisma.js';
import {
  createEmailVerificationCode,
  deleteEmailVerificationCodesByUserId,
  findLatestEmailVerificationCodeByUserId,
  incrementEmailVerificationFailedAttempts,
} from '../../queries/emailVerificationCode.js';

const MAX_FAILED_ATTEMPTS = 5;

export type { OtpCodePurpose };

export interface VerificationCodeSendResult {
  codeExpiresAt: string;
  codeExpiresInSeconds: number;
}

export class EmailVerificationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
    readonly codeExpiresInSeconds?: number,
  ) {
    super(message);
    this.name = 'EmailVerificationError';
  }
}

export const getEmailVerificationTtlMinutes = (): number => {
  const raw = process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
};

export const generateVerificationCode = (): string => {
  return String(randomInt(0, 10_000)).padStart(4, '0');
};

export const markUserEmailVerified = async (userId: string): Promise<User> => {
  await deleteEmailVerificationCodesByUserId(userId, 'email_verification');
  return prisma.user.update({
    data: { emailVerified: true },
    where: { id: userId },
  });
};

export const getActiveCodeRemainingSeconds = async (
  userId: string,
  purpose: OtpCodePurpose,
): Promise<number> => {
  const latest = await findLatestEmailVerificationCodeByUserId(userId, purpose);
  if (!latest) {
    return 0;
  }

  const remainingMs = latest.expiresAt.getTime() - Date.now();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
};

const sendCodeEmail = async (
  user: User,
  purpose: OtpCodePurpose,
  code: string,
  ttlMinutes: number,
): Promise<void> => {
  if (purpose === 'login') {
    await sendLoginCode({
      code,
      email: user.email,
      firstName: user.firstName,
      ttlMinutes,
    });
    return;
  }

  await sendEmailVerificationCode({
    code,
    email: user.email,
    firstName: user.firstName,
    ttlMinutes,
  });
};

export const createAndSendOtpCode = async (
  user: User,
  purpose: OtpCodePurpose,
): Promise<VerificationCodeSendResult> => {
  const latest = await findLatestEmailVerificationCodeByUserId(user.id, purpose);
  if (latest) {
    const remainingMs = latest.expiresAt.getTime() - Date.now();
    if (remainingMs > 0) {
      throw new EmailVerificationError(
        'Ya tienes un código vigente. Ingrésalo o espera a que expire.',
        429,
        'CODE_STILL_VALID',
        Math.ceil(remainingMs / 1000),
      );
    }
  }

  const code = generateVerificationCode();
  const codeHash = await createHash(code);
  const ttlMinutes = getEmailVerificationTtlMinutes();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const codeExpiresInSeconds = ttlMinutes * 60;

  await deleteEmailVerificationCodesByUserId(user.id, purpose);
  await createEmailVerificationCode({
    codeHash,
    expiresAt,
    purpose,
    userId: user.id,
  });

  await sendCodeEmail(user, purpose, code, ttlMinutes);

  return {
    codeExpiresAt: expiresAt.toISOString(),
    codeExpiresInSeconds,
  };
};

export const createAndSendVerificationCode = async (
  user: User,
): Promise<VerificationCodeSendResult> => createAndSendOtpCode(user, 'email_verification');

export const createAndSendLoginCode = async (user: User): Promise<VerificationCodeSendResult> =>
  createAndSendOtpCode(user, 'login');

const verifyOtpCode = async (
  email: string,
  code: string,
  purpose: OtpCodePurpose,
): Promise<User> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new EmailVerificationError('Código inválido o expirado', 400);
  }

  const record = await findLatestEmailVerificationCodeByUserId(user.id, purpose);
  if (!record) {
    throw new EmailVerificationError('Código inválido o expirado', 400);
  }
  if (record.expiresAt.getTime() < Date.now()) {
    await deleteEmailVerificationCodesByUserId(user.id, purpose);
    throw new EmailVerificationError('El código expiró. Solicita uno nuevo.', 400, 'CODE_EXPIRED');
  }
  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    await deleteEmailVerificationCodesByUserId(user.id, purpose);
    throw new EmailVerificationError(
      'Demasiados intentos fallidos. Solicita un nuevo código.',
      400,
      'TOO_MANY_ATTEMPTS',
    );
  }

  const matches = await comparePassword(code, record.codeHash);
  if (!matches) {
    const updated = await incrementEmailVerificationFailedAttempts(record.id);
    if (updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await deleteEmailVerificationCodesByUserId(user.id, purpose);
      throw new EmailVerificationError(
        'Demasiados intentos fallidos. Solicita un nuevo código.',
        400,
        'TOO_MANY_ATTEMPTS',
      );
    }
    throw new EmailVerificationError('Código incorrecto', 400, 'INVALID_CODE');
  }

  await deleteEmailVerificationCodesByUserId(user.id, purpose);
  return user;
};

export const verifyEmailCode = async (email: string, code: string): Promise<User> => {
  const user = await verifyOtpCode(email, code, 'email_verification');
  if (user.emailVerified) {
    return user;
  }
  return markUserEmailVerified(user.id);
};

export const verifyLoginCode = async (email: string, code: string): Promise<User> => {
  const user = await verifyOtpCode(email, code, 'login');
  if (!user.emailVerified) {
    throw new EmailVerificationError(
      'Debes verificar tu correo antes de iniciar sesión',
      403,
      'EMAIL_NOT_VERIFIED',
    );
  }
  return user;
};

export { deleteEmailVerificationCodesByUserId };
