import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { findUserById } from '../../queries/user.js';
import {
  deleteEmailVerificationCodesByUserId,
  markUserEmailVerified,
} from '../../services/emailVerification/index.js';
import { serializeUser } from './userUtils.js';

export async function verifyAdminUserEmail(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params['id'] === 'string' ? req.params['id'] : req.params['id']?.[0];
  if (!id) {
    res.status(400).json({ error: 'Id de usuario inválido' });
    return;
  }

  const existing = await findUserById(id);
  if (!existing) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }
  if (existing.emailVerified) {
    res.status(400).json({ error: 'El correo ya está verificado' });
    return;
  }

  await deleteEmailVerificationCodesByUserId(id);
  const user = await markUserEmailVerified(id);
  res.json({ user: serializeUser(user) });
}
