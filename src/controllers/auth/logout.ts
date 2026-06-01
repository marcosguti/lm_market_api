import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import prisma from '../../prisma.js';

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await prisma.token.deleteMany({ where: { userId } });

  res.json({ message: 'Logged out successfully' });
}
