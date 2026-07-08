import type { Request, Response } from 'express';

import { createHash } from '../../libs/passwordHashing.js';
import { revokeAllLinkedDevicesForUser } from '../../queries/linkedDevice.js';
import { deletePasswordResetToken } from '../../queries/passwordResetToken.js';
import { updateUserPassword } from '../../queries/user.js';
import {
  passwordResetTokenErrorMessage,
  validatePasswordResetToken,
} from '../../services/passwordResetTokenService.js';
import { resetPasswordSchema } from './schemas.js';

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const validation = resetPasswordSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { newPassword, token } = validation.value;

  const tokenValidation = await validatePasswordResetToken(token);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: passwordResetTokenErrorMessage(tokenValidation.reason) });
    return;
  }

  const hashedPassword = await createHash(newPassword);
  await updateUserPassword(tokenValidation.userId, hashedPassword);
  await deletePasswordResetToken(token);
  await revokeAllLinkedDevicesForUser(tokenValidation.userId);

  res.json({ message: 'Contraseña actualizada correctamente' });
}
