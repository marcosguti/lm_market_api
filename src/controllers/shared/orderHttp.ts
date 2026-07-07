import type { Response } from 'express';

import { OrderDomainError } from '../../services/orderService.js';

export function getParam(value: string | string[] | undefined): null | string {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function handleOrderError(err: unknown, res: Response): void {
  if (err instanceof OrderDomainError) {
    res.status(err.statusCode).json({
      code: err.code,
      details: err.details ?? null,
      error: err.message,
    });
    return;
  }
  res.status(500).json({ error: 'Error inesperado del servidor' });
}
