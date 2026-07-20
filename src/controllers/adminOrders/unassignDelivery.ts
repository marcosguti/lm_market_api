import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import {
  emitDeliveryOrderCancelled,
  emitKitchenOrderUpdated,
  emitOrderUpdated,
} from '../../realtime/socket.js';
import {
  assertAdminCanAccessOrder,
  getAnyOrderById,
  notifyDeliveryCancelled,
  notifyOrderStatusChange,
  unassignOrderFromDelivery,
} from '../../services/orderService.js';
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

    assertAdminCanAccessOrder(req.userType, req.storeId, before);

    const previousDriverId = before.deliveryUserId;
    const updated = await unassignOrderFromDelivery(orderId, req.userId);
    await notifyOrderStatusChange(updated, before.status);
    const orderPayload = {
      id: updated.id,
      status: updated.status,
      totalAmount: updated.totalAmount,
    };
    emitOrderUpdated(updated.userId, orderPayload);
    emitKitchenOrderUpdated(orderPayload);
    if (previousDriverId) {
      emitDeliveryOrderCancelled(previousDriverId, { orderId: updated.id });
      await notifyDeliveryCancelled(updated.id, previousDriverId);
    }

    res.json({ order: updated });
  } catch (err) {
    handleOrderError(err, res);
  }
}
