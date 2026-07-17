import type { OrderStatus } from '@prisma/client';
import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { sendOrderCancelledEmail } from '../../libs/sendEmail/index.js';
import { findUserById } from '../../queries/user.js';
import {
  emitDeliveryOrderCancelled,
  emitOrderCancelled,
  emitOrderUpdated,
  emitUserNotification,
} from '../../realtime/socket.js';
import {
  adminSetOrderStatus,
  createOrderStatusNotification,
  getAnyOrderById,
} from '../../services/orderService.js';
import { formatOrderStatusChangeBody } from '../../utils/orderStatusLabels.js';
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

    const nextStatus = validation.value.status as OrderStatus;
    const cancellationReason =
      nextStatus === 'cancelled'
        ? (validation.value.cancellationReason as string).trim()
        : undefined;

    const updated = await adminSetOrderStatus(orderId, nextStatus, req.userId, cancellationReason);
    await createOrderStatusNotification(updated, before.status as OrderStatus);
    emitUserNotification(updated.userId, {
      body: formatOrderStatusChangeBody(before.status, updated.status),
      newStatus: updated.status,
      orderId: updated.id,
      previousStatus: before.status,
      status: updated.status,
      title: 'Actualización de orden',
      type: 'ORDER_STATUS_CHANGED',
    });

    emitOrderUpdated(updated.userId, {
      id: updated.id,
      status: updated.status,
      totalAmount: updated.totalAmount,
    });

    if (updated.status === 'cancelled') {
      emitOrderCancelled({ orderId: updated.id });
      emitDeliveryOrderCancelled(updated.deliveryUserId, { orderId: updated.id });

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
