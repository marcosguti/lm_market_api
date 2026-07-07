import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { updatePendingOrderLines } from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';
import { asClient } from './asClient.js';
import { patchLinesSchema } from './schemas.js';

export async function patchCartLines(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;

  const validation = patchLinesSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  try {
    const result = await updatePendingOrderLines(
      userId,
      orderId,
      validation.value.lines,
      validation.value.storeId,
    );
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}
