import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { getDeliveryTrackingSnapshot } from '../../services/orderDeliveryTrackingService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function getAdminOrderTracking(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId || !req.userType) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }
  try {
    const tracking = await getDeliveryTrackingSnapshot(req.userType, req.userId, orderId);
    res.json({ tracking });
  } catch (err) {
    handleOrderError(err, res);
  }
}
