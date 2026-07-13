import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import {
  listNotificationsForInbox,
  listNotificationsForUser,
} from '../../services/orderService.js';
import { handleOrderError } from '../shared/orderHttp.js';
import { notificationsQuerySchema } from './schemas.js';

export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  const validation = notificationsQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  try {
    const { inbox, page, pageSize, recentRead } = validation.value;
    if (inbox) {
      const result = await listNotificationsForInbox(req.userId, recentRead);
      res.json(result);
      return;
    }
    const result = await listNotificationsForUser(req.userId, page, pageSize);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}
