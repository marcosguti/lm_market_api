import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { listUsersPaginated } from '../../queries/user.js';
import { listQuerySchema } from './schemas.js';
import { serializeUser } from './userUtils.js';

export async function listAdminUsers(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userType) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  const validation = listQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { page, pageSize, search } = validation.value;
  const { data, total } = await listUsersPaginated({
    actorType: req.userType,
    page,
    pageSize,
    search: search || undefined,
  });
  const totalPages = Math.ceil(total / pageSize) || 1;
  res.json({
    data: data.map(serializeUser),
    page,
    pageSize,
    total,
    totalPages,
  });
}
