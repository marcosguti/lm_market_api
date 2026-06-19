import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { getAllBanners } from '../../services/bannerService.js';

export async function listAdminBanners(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const banners = await getAllBanners();
    res.json({ data: banners });
  } catch (err) {
    console.error('listAdminBanners error:', err);
    res.status(500).json({ error: 'Error al cargar banners' });
  }
}
