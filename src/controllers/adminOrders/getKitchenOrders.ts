import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { assertStoreActive, StoreNotFoundError } from '../../queries/store.js';
import { listKitchenOrders } from '../../services/orderService.js';
import { handleOrderError } from '../shared/orderHttp.js';
import { kitchenListQuerySchema } from './schemas.js';

export async function getKitchenOrders(req: AuthRequest, res: Response): Promise<void> {
  const validation = kitchenListQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }
  try {
    const { createdFrom, createdTo, id, page, pageSize, status, storeId } = validation.value;
    const userType = req.userType!;

    let effectiveStoreId: string | undefined;
    if (userType === 'admin') {
      if (!req.storeId) {
        res.json({
          data: [],
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        });
        return;
      }
      effectiveStoreId = req.storeId;
    } else if (storeId) {
      await assertStoreActive(storeId);
      effectiveStoreId = storeId;
    }

    const result = await listKitchenOrders(page, pageSize, userType, {
      createdFrom,
      createdTo,
      id: id || undefined,
      status,
      storeId: effectiveStoreId,
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
