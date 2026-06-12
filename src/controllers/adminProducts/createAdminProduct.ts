import type { Response } from 'express';

import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middlewares/auth.js';

import { uploadFile } from '../../libs/filesInDigitalOcean/index.js';
import {
  findOrCreateBrand,
  findOrCreateDepartment,
  normalizeCatalogName,
} from '../../queries/brandDepartment.js';
import {
  createProduct,
  findProductByCode,
  findProductById,
  upsertProductStores,
} from '../../queries/product.js';
import { findStores } from '../../queries/store.js';
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
      const fileName = uuidv4();
      imageUrl = await uploadFile(req.file, fileName);
    }

    const product = await createProduct({
      active: body.active,
      brand: brandName,
      brandRef: { connect: { id: brand.id } },
      code: body.code,
      department: departmentName,
      departmentRef: { connect: { id: department.id } },
      description: body.description ?? null,
      imageUrl,
      name: body.name,
    });

    const allStores = await findStores();
    const storeEntries = body.stores?.length
      ? body.stores.map((s: { price: number; stockQuantity: number; storeId: string }) => ({
          price: s.price,
          stockQuantity: s.stockQuantity,
          storeId: s.storeId,
        }))
      : allStores.map((s) => ({ price: 0, stockQuantity: 0, storeId: s.id }));

    await upsertProductStores(product.id, storeEntries);

    const refreshed = await findProductById(product.id);
    res.status(201).json({ product: serializeAdminProduct(refreshed!) });
  } catch (e) {
    console.error('[admin-products] create failed', e);
    res.status(500).json({ error: 'Failed to create product' });
  }
}
