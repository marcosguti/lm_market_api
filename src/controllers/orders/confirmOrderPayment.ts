import type { OrderStatus } from '@prisma/client';
import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { emitKitchenNewPaid } from '../../realtime/socket.js';
import { confirmPendingOrderPayment } from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';
import { asClient } from './asClient.js';

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
