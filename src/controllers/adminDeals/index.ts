import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { getAllDeals } from '../../services/dealService.js';

export async function listAdminDeals(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const deals = await getAllDeals();
    res.json({ data: deals });
  } catch (err) {
    console.error('listAdminDeals error:', err);
    res.status(500).json({ error: 'Error al cargar deals' });
  }
}
