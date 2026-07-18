import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { getDeliveryTrackingSnapshot } from '../../services/orderDeliveryTrackingService.js';
import { asClient } from '../orders/asClient.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function getOrderTracking(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId || !req.userType) return;
  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }
  try {
    const tracking = await getDeliveryTrackingSnapshot(req.userType, userId, orderId);
    res.json({ tracking });
  } catch (err) {
    handleOrderError(err, res);
  }
}
