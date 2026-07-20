import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { findUserById } from '../../queries/user.js';
import { serializeAuthUser } from './serializeAuthUser.js';

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  const user = await findUserById(req.userId);
  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }
  res.json({ user: serializeAuthUser(user) });
}
