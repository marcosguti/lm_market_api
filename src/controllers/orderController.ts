import type { OrderStatus } from '@prisma/client';
import type { Response } from 'express';

import Joi from 'joi';

import type { AuthRequest } from '../middlewares/auth.js';

import { emitKitchenNewPaid } from '../realtime/socket.js';
import {
  confirmPendingOrderPayment,
  ensurePendingCart,
  getOrderByIdForUser,
  getUserOrderHistory,
  OrderDomainError,
  updatePendingOrderLines,
} from '../services/orderService.js';

const patchLinesSchema = Joi.object({
  lines: Joi.array()
    .items(
      Joi.object({
        code: Joi.string().trim().required(),
        quantity: Joi.number().integer().min(0).required(),
      }),
    )
    .required(),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export async function confirmOrderPayment(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;
  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }
  try {
    const result = await confirmPendingOrderPayment(userId, orderId);
    if (result.justConfirmed) {
      emitKitchenNewPaid({
        createdAt: result.order.createdAt,
        id: result.order.id,
        status: result.order.status as OrderStatus,
        totalAmount: result.order.totalAmount,
        userId: result.order.userId,
      });
    }
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

export async function getCart(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;
  try {
    const result = await ensurePendingCart(userId);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

export async function getOrderById(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;
  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }
  try {
    const result = await getOrderByIdForUser(userId, orderId);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

export async function getOrderHistory(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;
  const validation = paginationSchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  try {
    const { page, pageSize } = validation.value;
    const result = await getUserOrderHistory(userId, page, pageSize);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

export async function patchCartLines(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;

  const validation = patchLinesSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }

  try {
    const result = await updatePendingOrderLines(userId, orderId, validation.value.lines);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

function asClient(req: AuthRequest, res: Response): null | string {
  if (!req.userId || req.userType !== 'client') {
    res.status(403).json({ error: 'Only client users can use cart/order endpoints' });
    return null;
  }
  return req.userId;
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
