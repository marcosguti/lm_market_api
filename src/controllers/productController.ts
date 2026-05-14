import type { Product } from '@prisma/client';
import type { Request, Response } from 'express';

import Joi from 'joi';

import { findProductsPaginated } from '../queries/product.js';

const getProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(200).default(50),
  search: Joi.string().allow('').optional(),
  sort: Joi.string().valid('priceAsc', 'priceDesc').allow(null, '').optional().empty([null, '']),
});

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
