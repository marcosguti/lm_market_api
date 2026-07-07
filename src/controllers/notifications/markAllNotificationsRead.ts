import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { markAllNotificationsAsRead } from '../../services/orderService.js';
import { handleOrderError } from '../shared/orderHttp.js';

export async function markAllNotificationsRead(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  try {
    const count = await markAllNotificationsAsRead(req.userId);
    res.json({ count });
  } catch (err) {
    handleOrderError(err, res);
  }
}
