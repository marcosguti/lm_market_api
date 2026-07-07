import type { Response } from 'express';

import { Prisma } from '@prisma/client';

import type { AuthRequest } from '../../middlewares/auth.js';

import { deleteUserById } from '../../queries/user.js';

export async function deleteAdminUser(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params['id'] === 'string' ? req.params['id'] : req.params['id']?.[0];
  if (!id) {
    res.status(400).json({ error: 'Id de usuario inválido' });
    return;
  }
  if (req.userId === id) {
    res.status(403).json({ error: 'No puedes eliminar tu propia cuenta' });
    return;
  }
  try {
    await deleteUserById(id);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    throw err;
  }
}
