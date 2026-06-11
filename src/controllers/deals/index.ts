import type { Response } from 'express';

import { getActiveDeals } from '../../services/dealService.js';

export async function getActiveDealsHandler(_req: unknown, res: Response): Promise<void> {
  try {
    const imageUrls = await getActiveDeals();
    res.json({ data: imageUrls });
  } catch (err) {
    console.error('getActiveDeals error:', err);
    res.status(500).json({ error: 'Error al cargar deals' });
  }
}
