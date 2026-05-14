import type { OrderStatus } from '@prisma/client';
import type { Response } from 'express';

import Joi from 'joi';

import type { AuthRequest } from '../middlewares/auth.js';

import {
  emitDeliveryOrderCancelled,
  emitOrderCancelled,
  emitUserNotification,
} from '../realtime/socket.js';
import {
  adminSetOrderStatus,
  createOrderStatusNotification,
  getAnyOrderById,
  listKitchenOrders,
  OrderDomainError,
} from '../services/orderService.js';

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const patchStatusSchema = Joi.object({
  status: Joi.string().valid('preparando', 'listaParaReparto', 'entregada', 'cancelada').required(),
});

export async function getKitchenOrders(req: AuthRequest, res: Response): Promise<void> {
  const validation = paginationSchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  try {
    const { page, pageSize } = validation.value;
    const result = await listKitchenOrders(page, pageSize);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

export async function patchAdminOrderStatus(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'Order id is required' });
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
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const nextStatus = validation.value.status as OrderStatus;
    const updated = await adminSetOrderStatus(orderId, nextStatus);
    await createOrderStatusNotification(updated, before.status as OrderStatus);
    emitUserNotification(updated.userId, {
      body: `Tu orden cambió de ${before.status} a ${updated.status}`,
      orderId: updated.id,
      status: updated.status,
      title: 'Actualización de orden',
      type: 'ORDER_STATUS_CHANGED',
    });

    if (updated.status === 'cancelada') {
      emitOrderCancelled({ orderId: updated.id });
      emitDeliveryOrderCancelled(updated.deliveryUserId, { orderId: updated.id });
    }

    res.json({ order: updated });
  } catch (err) {
    handleOrderError(err, res);
  }
}

function getParam(value: string | string[] | undefined): null | string {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function handleOrderError(err: unknown, res: Response): void {
  if (err instanceof OrderDomainError) {
    res.status(err.statusCode).json({
      code: err.code,
      details: err.details ?? null,
      error: err.message,
    });
    return;
  }
  res.status(500).json({ error: 'Unexpected server error' });
}
