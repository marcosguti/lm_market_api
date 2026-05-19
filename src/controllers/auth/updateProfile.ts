import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { updateUser } from '../../queries/user.js';
import { updateProfileSchema } from './schemas.js';

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const validation = updateProfileSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const body = validation.value;
  const user = await updateUser(req.userId, {
    address: body.address,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
  });
  const { password: _p, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
}
