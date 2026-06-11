import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { asClient } from '../orders/asClient.js';
import { getParam } from '../shared/orderHttp.js';

export async function verifyPayment(req: AuthRequest, res: Response): Promise<void> {
  const clientId = asClient(req, res);
  if (!clientId) return;

  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }

  const { verify } = req.body as { verify?: boolean };
  if (typeof verify !== 'boolean') {
    res.status(400).json({ error: 'verify must be a boolean' });
    return;
  }

  try {
    const { verifyPaymentByAdmin } = await import('../../services/orderService.js');
    const order = await verifyPaymentByAdmin(orderId, clientId, verify);
    res.json({ order });
  } catch (err) {
    const { handleOrderError } = await import('../shared/orderHttp.js');
    handleOrderError(err, res);
  }
}
