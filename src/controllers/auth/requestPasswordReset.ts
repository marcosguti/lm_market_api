import type { Request, Response } from 'express';

import { v4 as uuid } from 'uuid';

import { sendPasswordResetEmail } from '../../libs/sendEmail/index.js';
import {
  createPasswordResetToken,
  deletePasswordResetTokensByUserId,
} from '../../queries/passwordResetToken.js';
import { findUserByEmail } from '../../queries/user.js';
import { requestResetSchema } from './schemas.js';

const getResetTokenTtlHours = (): number => {
  const raw = process.env.PASSWORD_RESET_TOKEN_TTL_HOURS;
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const getWebBaseUrl = (): string =>
  (process.env.WEB_BASE_URL ?? 'https://www.lmmarket.com').replace(/\/$/, '');

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  const validation = requestResetSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { email } = validation.value;

  const user = await findUserByEmail(email);
  if (!user) {
    res.json({
      message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.',
    });
    return;
  }

  const ttlHours = getResetTokenTtlHours();
  const token = uuid();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await deletePasswordResetTokensByUserId(user.id);
  await createPasswordResetToken({ expiresAt, token, userId: user.id });

  const resetUrl = `${getWebBaseUrl()}/restablecer-contrasena?token=${token}`;
  try {
    await sendPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      resetUrl,
      ttlHours,
    });
  } catch (err) {
    console.error('[password-reset] failed to send email', {
      email,
      error: err instanceof Error ? err.message : err,
      userId: user.id,
    });
  }

  res.json({
    message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.',
  });
}
