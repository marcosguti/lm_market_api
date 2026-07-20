import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { emitKitchenOrderUpdated, emitOrderUpdated } from '../../realtime/socket.js';
import {
  getAnyOrderById,
  notifyOrderStatusChange,
  startOrderDelivering,
} from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function startDeliveryOrder(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId || !req.userType) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  try {
    const before = await getAnyOrderById(orderId);
    const updated = await startOrderDelivering(req.userType, orderId, req.userId);
    if (before) {
      await notifyOrderStatusChange(updated, before.status);
      const orderPayload = {
        id: updated.id,
        status: updated.status,
        totalAmount: updated.totalAmount,
      };
      emitOrderUpdated(updated.userId, orderPayload);
      emitKitchenOrderUpdated(orderPayload);
      const driverId = updated.deliveryUserId ?? before.deliveryUserId;
      if (driverId) {
        emitOrderUpdated(driverId, orderPayload);
      }
    }
    res.json({ order: updated });
  } catch (err) {
    handleOrderError(err, res);
  }
}
