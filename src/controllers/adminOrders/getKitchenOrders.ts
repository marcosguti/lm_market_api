import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { assertStoreActive, StoreNotFoundError } from '../../queries/store.js';
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
    if (storeId) {
      await assertStoreActive(storeId);
    }
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
    if (err instanceof StoreNotFoundError) {
      res.status(err.statusCode).json({ code: err.code, error: err.message });
      return;
    }
    handleOrderError(err, res);
  }
}
