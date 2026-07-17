import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import {
  emitDeliveryOrderCancelled,
  emitKitchenOrderUpdated,
  emitOrderUpdated,
  emitUserNotification,
} from '../../realtime/socket.js';
import {
  createOrderStatusNotification,
  getAnyOrderById,
  unassignOrderFromDelivery,
} from '../../services/orderService.js';
import { formatOrderStatusChangeBody } from '../../utils/orderStatusLabels.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function unassignDelivery(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  try {
    const before = await getAnyOrderById(orderId);
    if (!before) {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }

    const previousDriverId = before.deliveryUserId;
    const updated = await unassignOrderFromDelivery(orderId, req.userId);
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
    const orderPayload = {
      id: updated.id,
      status: updated.status,
      totalAmount: updated.totalAmount,
    };
    emitOrderUpdated(updated.userId, orderPayload);
    emitKitchenOrderUpdated(orderPayload);
    if (previousDriverId) {
      emitDeliveryOrderCancelled(previousDriverId, { orderId: updated.id });
    }

    res.json({ order: updated });
  } catch (err) {
    handleOrderError(err, res);
  }
}
