import type { Request, Response } from 'express';

import { findProductsPaginated } from '../../queries/product.js';
import { assertStoreActive, StoreNotFoundError } from '../../queries/store.js';
import { getProductsQuerySchema } from './schemas.js';
import { serializePublicProduct } from './serializePublicProduct.js';

export async function getProducts(req: Request, res: Response): Promise<void> {
  const validation = getProductsQuerySchema.validate(req.query, {
    convert: true,
  });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { brand, department, maxPrice, minPrice, page, pageSize, search, sort, storeId } =
    validation.value;

  try {
    await assertStoreActive(storeId);
  } catch (e) {
    if (e instanceof StoreNotFoundError) {
      res.status(e.statusCode).json({ code: e.code, error: e.message });
      return;
    }
    throw e;
  }

  const result = await findProductsPaginated({
    brand: brand || undefined,
    department: department || undefined,
    maxPrice: maxPrice || undefined,
    minPrice: minPrice || undefined,
    page,
    pageSize,
    search: search || undefined,
    sort,
    storeId,
  });

  res.json({
    ...result,
    data: result.data.map(serializePublicProduct),
  });
}
