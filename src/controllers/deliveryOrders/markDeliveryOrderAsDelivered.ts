import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { emitUserNotification } from '../../realtime/socket.js';
import {
  createOrderStatusNotification,
  getAnyOrderById,
  markOrderDelivered,
} from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function markDeliveryOrderAsDelivered(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId || !req.userType) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }
  try {
    const before = await getAnyOrderById(orderId);
    const updated = await markOrderDelivered(req.userType, orderId, req.userId);
    if (before) {
      await createOrderStatusNotification(updated, before.status);
      emitUserNotification(updated.userId, {
        body: `Tu orden cambió de ${before.status} a ${updated.status}`,
        orderId: updated.id,
        status: updated.status,
        title: 'Actualización de orden',
        type: 'ORDER_STATUS_CHANGED',
      });
    }
    res.json({ order: updated });
  } catch (err) {
    handleOrderError(err, res);
  }
}
