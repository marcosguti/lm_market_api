import type { Product } from '@prisma/client';
import type { Request, Response } from 'express';

import { findProductsPaginated } from '../../queries/product.js';
import { getProductsQuerySchema } from './schemas.js';

export async function getProducts(req: Request, res: Response): Promise<void> {
  const validation = getProductsQuerySchema.validate(req.query, {
    convert: true,
  });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { page, pageSize, search, sort } = validation.value;

  const result = await findProductsPaginated({
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

/** Catálogo público: sin costo, margen ni datos internos de inventario. */
function serializePublicProduct(p: Product) {
  return {
    brand: p.brand,
    code: p.code,
    createdAt: p.createdAt,
    department: p.department,
    description: p.description,
    id: p.id,
    imageUrl: p.imageUrl,
    name: p.name,
    price: Number(p.price.toString()),
    salesToday: p.salesToday,
    totalStock: p.totalStock,
    updatedAt: p.updatedAt,
  };
}
