import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';
import type { AdminProductActiveFilter } from '../../queries/product.js';

import { findAdminProductsPaginated } from '../../queries/product.js';
import { listQuerySchema } from './schemas.js';
import { serializeAdminProduct } from './serializeAdminProduct.js';

export async function listAdminProducts(req: AuthRequest, res: Response): Promise<void> {
  const validation = listQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { active, brand, department, page, pageSize, search, sort } = validation.value;

  const result = await findAdminProductsPaginated({
    active: active as AdminProductActiveFilter,
    brand: brand || undefined,
    department: department || undefined,
    page,
    pageSize,
    search: search || undefined,
    sort,
  });

  res.json({
    ...result,
    data: result.data.map(serializeAdminProduct),
  });
}
