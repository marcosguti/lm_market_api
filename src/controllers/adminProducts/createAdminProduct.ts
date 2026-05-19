import type { Response } from 'express';

import { Prisma } from '@prisma/client';

import type { AuthRequest } from '../../middlewares/auth.js';

import { createProduct, findProductByCode } from '../../queries/product.js';
import { createSchema } from './schemas.js';
import { serializeAdminProduct } from './serializeAdminProduct.js';

export async function createAdminProduct(req: AuthRequest, res: Response): Promise<void> {
  const validation = createSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const body = validation.value;

  const existing = await findProductByCode(body.code);
  if (existing) {
    res.status(409).json({ error: 'Product code already exists' });
    return;
  }

  try {
    const product = await createProduct({
      active: body.active,
      adminMovements: body.adminMovements ?? null,
      brand: body.brand,
      code: body.code,
      cost: body.cost as Prisma.Decimal,
      department: body.department,
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
      initialBalance: body.initialBalance ?? null,
      inventoryValueBs: (body.inventoryValueBs as Prisma.Decimal | undefined) ?? null,
      marginPct: (body.marginPct as Prisma.Decimal | undefined) ?? null,
      name: body.name,
      price: body.price as Prisma.Decimal,
      salesToday: body.salesToday ?? null,
      totalStock: body.totalStock ?? null,
    });
    res.status(201).json({ product: serializeAdminProduct(product) });
  } catch (e) {
    console.error('[admin-products] create failed', e);
    res.status(500).json({ error: 'Failed to create product' });
  }
}
