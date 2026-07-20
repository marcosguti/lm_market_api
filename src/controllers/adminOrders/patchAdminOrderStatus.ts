import type { OrderStatus } from '@prisma/client';
import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { sendOrderCancelledEmail } from '../../libs/sendEmail/index.js';
import { findUserById } from '../../queries/user.js';
import {
  emitDeliveryOrderCancelled,
  emitOrderCancelled,
  emitOrderUpdated,
} from '../../realtime/socket.js';
import { endDeliveryTrackingAndNotify } from '../../services/orderDeliveryTrackingService.js';
import {
  adminSetOrderStatus,
  assertAdminCanAccessOrder,
  getAnyOrderById,
  notifyDeliveryCancelled,
  notifyOrderStatusChange,
} from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';
import { patchStatusSchema } from './schemas.js';

export async function patchAdminOrderStatus(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }
  const validation = patchStatusSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  try {
    const before = await getAnyOrderById(orderId);
    if (!before) {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    assertAdminCanAccessOrder(req.userType, req.storeId, before);

    const nextStatus = validation.value.status as OrderStatus;
    const cancellationReason =
      nextStatus === 'cancelled'
        ? (validation.value.cancellationReason as string).trim()
        : undefined;

    const previousDriverId = before.deliveryUserId;
    const updated = await adminSetOrderStatus(orderId, nextStatus, req.userId, cancellationReason);
    await notifyOrderStatusChange(updated, before.status as OrderStatus);

    emitOrderUpdated(updated.userId, {
      id: updated.id,
      status: updated.status,
      totalAmount: updated.totalAmount,
    });

    if (updated.status === 'cancelled') {
      emitOrderCancelled({ orderId: updated.id });
      const driverId = updated.deliveryUserId ?? previousDriverId;
      if (driverId) {
        emitDeliveryOrderCancelled(driverId, { orderId: updated.id });
        await notifyDeliveryCancelled(updated.id, driverId);
      }
      if (before.status === 'delivering') {
        await endDeliveryTrackingAndNotify({
          clientUserId: updated.userId,
          deliveryUserId: driverId,
          orderId: updated.id,
          reason: 'cancelled',
        });
      }

      try {
        const customer = await findUserById(updated.userId);
        if (customer?.email && cancellationReason) {
          await sendOrderCancelledEmail({
            email: customer.email,
            firstName: customer.firstName,
            reason: cancellationReason,
            shortOrderId: formatShortOrderId(updated.id),
          });
        }
      } catch (emailErr) {
        console.error('[orders] failed to send cancellation email', {
          error: emailErr,
          orderId: updated.id,
        });
      }
    }

    res.json({ order: updated });
  } catch (err) {
    handleOrderError(err, res);
  }
}

function formatShortOrderId(orderId: string): string {
  const segment = orderId.split('-')[0]?.trim() || orderId.trim();
  return `#${segment}`;
}
