import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { comparePassword, createHash } from '../../libs/passwordHashing.js';
import { findUserById, updateUserPassword } from '../../queries/user.js';
import { changePasswordSchema } from './schemas.js';

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const validation = changePasswordSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { currentPassword, newPassword } = validation.value;
  const user = await findUserById(req.userId);
  if (!user || !(await comparePassword(currentPassword, user.password))) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }
  const hashedPassword = await createHash(newPassword);
  await updateUserPassword(req.userId, hashedPassword);
  res.json({ message: 'Password updated successfully' });
}
