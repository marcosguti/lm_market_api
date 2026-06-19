import type { Response } from 'express';

import { getActiveBanners } from '../../services/bannerService.js';

export async function getActiveBannersHandler(_req: unknown, res: Response): Promise<void> {
  try {
    const banners = await getActiveBanners();
    res.json({
      data: banners.map((banner) => ({
        description: banner.description,
        id: banner.id,
        imageUrl: banner.imageUrl,
      })),
    });
  } catch (err) {
    console.error('getActiveBanners error:', err);
    res.status(500).json({ error: 'Error al cargar banners' });
  }
}
