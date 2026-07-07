import type { Request, Response } from 'express';

import { createHash } from '../../libs/passwordHashing.js';
import {
  deletePasswordResetToken,
  findPasswordResetTokenByToken,
} from '../../queries/passwordResetToken.js';
import { updateUserPassword } from '../../queries/user.js';
import { resetPasswordSchema } from './schemas.js';

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const validation = resetPasswordSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { newPassword, token } = validation.value;

  const resetRecord = await findPasswordResetTokenByToken(token);
  if (!resetRecord) {
    res.status(400).json({ error: 'Token inválido o expirado' });
    return;
  }
  if (new Date() > resetRecord.expiresAt) {
    await deletePasswordResetToken(token);
    res.status(400).json({ error: 'Token inválido o expirado' });
    return;
  }

  const hashedPassword = await createHash(newPassword);
  await updateUserPassword(resetRecord.userId, hashedPassword);
  await deletePasswordResetToken(token);

  res.json({ message: 'Contraseña actualizada correctamente' });
}
