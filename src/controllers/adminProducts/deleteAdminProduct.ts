import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { deactivateProductById, findProductById } from '../../queries/product.js';
import { serializeAdminProduct } from './serializeAdminProduct.js';

export async function deleteAdminProduct(req: AuthRequest, res: Response): Promise<void> {
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

  const product = await deactivateProductById(id);
  res.json({ message: 'Producto desactivado', product: serializeAdminProduct(product) });
}
