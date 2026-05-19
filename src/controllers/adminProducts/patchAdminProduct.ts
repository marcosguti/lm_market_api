import type { Response } from 'express';

import { Prisma } from '@prisma/client';

import type { AuthRequest } from '../../middlewares/auth.js';

import { findProductById, updateProductById } from '../../queries/product.js';
import { patchSchema } from './schemas.js';
import { serializeAdminProduct } from './serializeAdminProduct.js';

export async function patchAdminProduct(req: AuthRequest, res: Response): Promise<void> {
  const validation = patchSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  const existing = await findProductById(id);
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const body = validation.value;
  const data: Prisma.ProductUpdateInput = {};
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null;
  if (body.brand !== undefined) data.brand = body.brand;
  if (body.description !== undefined) data.description = body.description || null;

  const product = await updateProductById(id, data);
  res.json({ product: serializeAdminProduct(product) });
}
