import type { Response } from 'express';

import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middlewares/auth.js';

import { deleteFile, uploadFile } from '../../libs/filesInDigitalOcean/index.js';
import {
  findOrCreateBrand,
  findOrCreateDepartment,
  normalizeCatalogName,
} from '../../queries/brandDepartment.js';
import { findProductById, updateProductById, upsertProductStores } from '../../queries/product.js';
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
    res.status(400).json({ error: 'Id de producto inválido' });
    return;
  }

  const existing = await findProductById(id);
  if (!existing) {
    res.status(404).json({ error: 'Producto no encontrado' });
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
      const fileName = uuidv4();
      const newImageUrl = await uploadFile(req.file, fileName);
      data.imageUrl = newImageUrl;

      if (existing.imageUrl) {
        await deleteFile(existing.imageUrl);
      }
    }

    await updateProductById(id, data);

    if (body.stores) {
      await upsertProductStores(
        id,
        body.stores.map((s: { price: number; stockQuantity: number; storeId: string }) => ({
          price: s.price,
          stockQuantity: s.stockQuantity,
          storeId: s.storeId,
        })),
      );
    }

    const refreshed = await findProductById(id);
    res.json({ product: serializeAdminProduct(refreshed!) });
  } catch (e) {
    console.error('[admin-products] stack:', (e as Error).stack);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
}
