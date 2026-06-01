import type { Response } from 'express';

import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import type { AuthRequest } from '../../middlewares/auth.js';

import { deleteFile, uploadFile } from '../../libs/filesInDigitalOcean/index.js';
import {
  findOrCreateBrand,
  findOrCreateDepartment,
  normalizeCatalogName,
} from '../../queries/brandDepartment.js';
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

  if (body.description !== undefined) data.description = body.description || null;

  try {
    if (body.brand !== undefined) {
      const brandName = normalizeCatalogName(body.brand);
      const brand = await findOrCreateBrand(brandName);
      data.brand = brandName;
      data.brandRef = { connect: { id: brand.id } };
    }
    if (body.department !== undefined) {
      const departmentName = normalizeCatalogName(body.department);
      const department = await findOrCreateDepartment(departmentName);
      data.department = departmentName;
      data.departmentRef = { connect: { id: department.id } };
    }

    if (req.file) {
      const fileName = randomUUID();
      const newImageUrl = await uploadFile(req.file, fileName);
      data.imageUrl = newImageUrl;

      if (existing.imageUrl) {
        await deleteFile(existing.imageUrl);
      }
    }

    const product = await updateProductById(id, data);
    res.json({ product: serializeAdminProduct(product) });
  } catch (e) {
    console.error('[admin-products] stack:', (e as Error).stack);
    res.status(500).json({ error: 'Failed to update product' });
  }
}
