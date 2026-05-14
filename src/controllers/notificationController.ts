import type { Response } from 'express';

import Joi from 'joi';

import type { AuthRequest } from '../middlewares/auth.js';

import {
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  OrderDomainError,
} from '../services/orderService.js';

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
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
    const result = await listNotificationsForUser(req.userId, page, pageSize);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const count = await markAllNotificationsAsRead(req.userId);
    res.json({ count });
  } catch (err) {
    handleOrderError(err, res);
  }
}

export async function markNotificationRead(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const notificationId = getParam(req.params.id);
  if (!notificationId) {
    res.status(400).json({ error: 'Notification id is required' });
    return;
  }
  try {
    await markNotificationAsRead(req.userId, notificationId);
    res.json({ ok: true });
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
