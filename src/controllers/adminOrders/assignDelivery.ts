import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { emitKitchenOrderUpdated, emitOrderUpdated } from '../../realtime/socket.js';
import {
  assertAdminCanAccessOrder,
  assignOrderToDelivery,
  getAnyOrderById,
  notifyDeliveryAssigned,
  notifyOrderStatusChange,
} from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';
import { assignDeliverySchema } from './schemas.js';

export async function assignDelivery(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  const validation = assignDeliverySchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }

  try {
    const before = await getAnyOrderById(orderId);
    if (!before) {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }

    assertAdminCanAccessOrder(req.userType, req.storeId, before);

    const deliveryUserId = validation.value.deliveryUserId as string;
    const updated = await assignOrderToDelivery(orderId, deliveryUserId, req.userId);
    await notifyOrderStatusChange(updated, before.status);
    await notifyDeliveryAssigned(updated, deliveryUserId);
    const orderPayload = {
      id: updated.id,
      status: updated.status,
      totalAmount: updated.totalAmount,
    };
    emitOrderUpdated(updated.userId, orderPayload);
    emitOrderUpdated(deliveryUserId, orderPayload);
    emitKitchenOrderUpdated(orderPayload);

    res.json({ order: updated });
  } catch (err) {
    handleOrderError(err, res);
  }
}
