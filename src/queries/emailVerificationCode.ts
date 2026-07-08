import type { EmailVerificationCode, OtpCodePurpose } from '@prisma/client';

import prisma from '../prisma.js';

export async function createEmailVerificationCode(data: {
  codeHash: string;
  expiresAt: Date;
  purpose: OtpCodePurpose;
  userId: string;
}): Promise<EmailVerificationCode> {
  return prisma.emailVerificationCode.create({
    data: {
      codeHash: data.codeHash,
      expiresAt: data.expiresAt,
      purpose: data.purpose,
      userId: data.userId,
    },
  });
}

export async function deleteEmailVerificationCodesByUserId(
  userId: string,
  purpose?: OtpCodePurpose,
): Promise<void> {
  await prisma.emailVerificationCode.deleteMany({
    where: {
      userId,
      ...(purpose ? { purpose } : {}),
    },
  });
}

export async function findLatestEmailVerificationCodeByUserId(
  userId: string,
  purpose: OtpCodePurpose,
): Promise<EmailVerificationCode | null> {
  return prisma.emailVerificationCode.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { purpose, userId },
  });
}

export async function incrementEmailVerificationFailedAttempts(
  id: string,
): Promise<EmailVerificationCode> {
  return prisma.emailVerificationCode.update({
    data: { failedAttempts: { increment: 1 } },
    where: { id },
  });
}
