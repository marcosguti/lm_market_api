import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { listKitchenOrders } from '../../services/orderService.js';
import { handleOrderError } from '../shared/orderHttp.js';
import { kitchenListQuerySchema } from './schemas.js';

export async function getKitchenOrders(req: AuthRequest, res: Response): Promise<void> {
  const validation = kitchenListQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  try {
    const { createdFrom, createdTo, id, page, pageSize, status, storeId } = validation.value;
    const userType = req.userType!;
    const result = await listKitchenOrders(page, pageSize, userType, {
      createdFrom,
      createdTo,
      id: id || undefined,
      status,
      storeId: storeId || undefined,
    });
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}
