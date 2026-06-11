import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { deleteDeal, getDealById } from '../../services/dealService.js';
import { getParam } from '../shared/orderHttp.js';

export async function deleteAdminDeal(req: AuthRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Deal id is required' });
    return;
  }

  const existing = await getDealById(id);
  if (!existing) {
    res.status(404).json({ error: 'Deal no encontrado' });
    return;
  }

  try {
    await deleteDeal(id);
    res.json({ message: 'Deal eliminado' });
  } catch (err) {
    console.error('deleteAdminDeal error:', err);
    res.status(500).json({ error: 'Error al eliminar deal' });
  }
}
