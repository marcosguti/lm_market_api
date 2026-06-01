import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { listKitchenOrders } from '../../services/orderService.js';
import { handleOrderError } from '../shared/orderHttp.js';
import { paginationQuerySchema } from './schemas.js';

export async function getKitchenOrders(req: AuthRequest, res: Response): Promise<void> {
  const validation = paginationQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  try {
    const { page, pageSize } = validation.value;
    const userType = req.userType!;
    const result = await listKitchenOrders(page, pageSize, userType);
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}
