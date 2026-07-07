import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { getParam } from '../shared/orderHttp.js';

export async function verifyPayment(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  const { verify } = req.body as { verify?: boolean };
  if (typeof verify !== 'boolean') {
    res.status(400).json({ error: 'verify debe ser un booleano' });
    return;
  }

  try {
    const { verifyPaymentByAdmin } = await import('../../services/orderService.js');
    const order = await verifyPaymentByAdmin(orderId, req.userId, verify);
    res.json({ order });
  } catch (err) {
    const { handleOrderError } = await import('../shared/orderHttp.js');
    handleOrderError(err, res);
  }
}
