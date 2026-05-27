import type { Request, Response } from 'express';

import { findProductsPaginated } from '../../queries/product.js';
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
  const { brand, department, page, pageSize, search, sort } = validation.value;

  const result = await findProductsPaginated({
    brand: brand || undefined,
    department: department || undefined,
    page,
    pageSize,
    search: search || undefined,
    sort,
  });

  res.json({
    ...result,
    data: result.data.map(serializePublicProduct),
  });
}
