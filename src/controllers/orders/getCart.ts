import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { ensurePendingCart } from '../../services/orderService.js';
import { handleOrderError } from '../shared/orderHttp.js';
import { asClient } from './asClient.js';

export async function getCart(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;
  try {
    const storeId =
      typeof req.query.storeId === 'string' && req.query.storeId.trim()
        ? req.query.storeId.trim()
        : undefined;
    const result = await ensurePendingCart(userId, storeId);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}
