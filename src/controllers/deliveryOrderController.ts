import type { Response } from 'express';

import Joi from 'joi';

import type { AuthRequest } from '../middlewares/auth.js';

import { emitUserNotification } from '../realtime/socket.js';
import {
  claimDeliveryOrder,
  createOrderStatusNotification,
  getAnyOrderById,
  listDeliveryAvailable,
  listDeliveryMine,
  markOrderDelivered,
  OrderDomainError,
} from '../services/orderService.js';

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export async function claimOrderForDelivery(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }
  try {
    const before = await getAnyOrderById(orderId);
    const updated = await claimDeliveryOrder(orderId, req.userId);
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

export async function getDeliveryAvailableOrders(req: AuthRequest, res: Response): Promise<void> {
  const validation = paginationSchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  try {
    const { page, pageSize } = validation.value;
    const result = await listDeliveryAvailable(page, pageSize);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

export async function getMyDeliveryOrders(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const validation = paginationSchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  try {
    const { page, pageSize } = validation.value;
    const result = await listDeliveryMine(req.userId, page, pageSize);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

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
