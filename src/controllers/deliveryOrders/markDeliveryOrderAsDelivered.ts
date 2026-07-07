import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { emitUserNotification } from '../../realtime/socket.js';
import {
  createOrderStatusNotification,
  getAnyOrderById,
  markOrderDelivered,
} from '../../services/orderService.js';
import { formatOrderStatusChangeBody } from '../../utils/orderStatusLabels.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function markDeliveryOrderAsDelivered(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId || !req.userType) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }
  try {
    const before = await getAnyOrderById(orderId);
    const updated = await markOrderDelivered(req.userType, orderId, req.userId);
    if (before) {
      await createOrderStatusNotification(updated, before.status);
      emitUserNotification(updated.userId, {
        body: formatOrderStatusChangeBody(before.status, updated.status),
        newStatus: updated.status,
        orderId: updated.id,
        previousStatus: before.status,
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
