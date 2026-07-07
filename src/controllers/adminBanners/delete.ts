import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { deleteBanner, getBannerById } from '../../services/bannerService.js';
import { getParam } from '../shared/orderHttp.js';

export async function deleteAdminBanner(req: AuthRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'El id del banner es requerido' });
    return;
  }

  const existing = await getBannerById(id);
  if (!existing) {
    res.status(404).json({ error: 'Banner no encontrado' });
    return;
  }

  try {
    await deleteBanner(id);
    res.json({ message: 'Banner eliminado' });
  } catch (err) {
    console.error('deleteAdminBanner error:', err);
    res.status(500).json({ error: 'Error al eliminar banner' });
  }
}
