import type { Response } from 'express';

import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import type { AuthRequest } from '../../middlewares/auth.js';

import { uploadFile } from '../../libs/filesInDigitalOcean/index.js';
import {
  findOrCreateBrand,
  findOrCreateDepartment,
  normalizeCatalogName,
} from '../../queries/brandDepartment.js';
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
    const brandName = normalizeCatalogName(body.brand);
    const departmentName = normalizeCatalogName(body.department);
    const [brand, department] = await Promise.all([
      findOrCreateBrand(brandName),
      findOrCreateDepartment(departmentName),
    ]);

    let imageUrl: null | string = null;
    if (req.file) {
      const fileName = randomUUID();
      imageUrl = await uploadFile(req.file, fileName);
    }

    const product = await createProduct({
      active: body.active,
      adminMovements: body.adminMovements ?? null,
      brand: brandName,
      brandRef: { connect: { id: brand.id } },
      code: body.code,
      cost: body.cost as Prisma.Decimal,
      department: departmentName,
      departmentRef: { connect: { id: department.id } },
      description: body.description ?? null,
      imageUrl,
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
