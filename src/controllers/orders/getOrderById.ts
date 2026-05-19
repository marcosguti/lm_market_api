import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { getOrderByIdForUser } from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';
import { asClient } from './asClient.js';

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
