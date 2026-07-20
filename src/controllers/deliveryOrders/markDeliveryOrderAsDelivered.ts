import type { Response } from 'express';

import { randomUUID } from 'crypto';

import type { AuthRequest } from '../../middlewares/auth.js';

import { uploadDeliveryProof } from '../../libs/filesInDigitalOcean/index.js';
import { emitKitchenOrderUpdated, emitOrderUpdated } from '../../realtime/socket.js';
import { endDeliveryTrackingAndNotify } from '../../services/orderDeliveryTrackingService.js';
import {
  getAnyOrderById,
  markOrderDelivered,
  notifyOrderStatusChange,
} from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function markDeliveryOrderAsDelivered(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId || !req.userType) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  const file = req.file;
  if (!file) {
    res
      .status(400)
      .json({ code: 'DELIVERY_PROOF_REQUIRED', error: 'La foto de entrega es obligatoria' });
    return;
  }

  try {
    const proofUrl = await uploadDeliveryProof(
      file.buffer,
      file.mimetype,
      extensionFromMimetype(file.mimetype),
      randomUUID(),
    );

    const before = await getAnyOrderById(orderId);
    const updated = await markOrderDelivered(req.userType, orderId, req.userId, proofUrl);
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
      await endDeliveryTrackingAndNotify({
        clientUserId: updated.userId,
        deliveryUserId: driverId,
        orderId: updated.id,
        reason: 'delivered',
      });
    }
    res.json({ order: updated });
  } catch (err) {
    handleOrderError(err, res);
  }
}

function extensionFromMimetype(mimetype: string): string {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  return 'jpg';
}
