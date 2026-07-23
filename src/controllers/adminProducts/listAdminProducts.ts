import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';
import type { AdminProductActiveFilter } from '../../queries/product.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { findAdminProductsPaginated } from '../../queries/product.js';
import { assertStoreActive, StoreNotFoundError } from '../../queries/store.js';
import { listQuerySchema } from './schemas.js';
import { serializeAdminProduct } from './serializeAdminProduct.js';

export async function listAdminProducts(req: AuthRequest, res: Response): Promise<void> {
  const validation = listQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }
  const { active, brand, department, page, pageSize, search, sort, storeId } = validation.value;

  if (storeId) {
    try {
      await assertStoreActive(storeId);
    } catch (e) {
      if (e instanceof StoreNotFoundError) {
        res.status(e.statusCode).json({ code: e.code, error: e.message });
        return;
      }
      throw e;
    }
  }

  const result = await findAdminProductsPaginated({
    active: active as AdminProductActiveFilter,
    brand: brand || undefined,
    department: department || undefined,
    page,
    pageSize,
    search: search || undefined,
    sort,
    storeId: storeId || undefined,
  });

  res.json({
    ...result,
    data: result.data.map(serializeAdminProduct),
  });
}
