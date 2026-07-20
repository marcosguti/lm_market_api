import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import {
  assertAdminCanAccessOrder,
  getAnyOrderById,
  notifyOrderPaid,
} from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

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
    const before = await getAnyOrderById(orderId);
    if (!before) {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }
    assertAdminCanAccessOrder(req.userType, req.storeId, before);

    const { verifyPaymentByAdmin } = await import('../../services/orderService.js');
    const order = await verifyPaymentByAdmin(orderId, req.userId, verify);
    if (verify) {
      await notifyOrderPaid(order, 'paymentPendingConfirmation');
    }
    res.json({ order });
  } catch (err) {
    handleOrderError(err, res);
  }
}
