import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { markNotificationAsRead } from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function markNotificationRead(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  const notificationId = getParam(req.params.id);
  if (!notificationId) {
    res.status(400).json({ error: 'El id de la notificación es requerido' });
    return;
  }
  try {
    await markNotificationAsRead(req.userId, notificationId);
    res.json({ ok: true });
  } catch (err) {
    handleOrderError(err, res);
  }
}
