import type { Request, Response } from 'express';

import { v4 as uuid } from 'uuid';

import { createPasswordResetToken } from '../../queries/passwordResetToken.js';
import { findUserByEmail } from '../../queries/user.js';
import { requestResetSchema } from './schemas.js';

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  const validation = requestResetSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { email } = validation.value;

  const user = await findUserByEmail(email);
  if (user) {
    const token = uuid();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken({ expiresAt, token, userId: user.id });
  }

  res.json({
    message: 'If the email exists, you will receive instructions to reset your password.',
  });
}
