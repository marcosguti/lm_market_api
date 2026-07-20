import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import {
  assertAdminCanAccessOrder,
  getAnyOrderById,
  listOrderStatusHistory,
} from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function getOrderStatusHistory(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  try {
    const order = await getAnyOrderById(orderId);
    if (!order) {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }
    assertAdminCanAccessOrder(req.userType, req.storeId, order);

    const history = await listOrderStatusHistory(orderId);
    res.json({ history });
  } catch (err) {
    handleOrderError(err, res);
  }
}
