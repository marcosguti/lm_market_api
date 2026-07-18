import { Router } from 'express';

import { findStores, serializeStore } from '../queries/store.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const stores = await findStores();
    res.json(stores.map(serializeStore));
  } catch (e) {
    console.error('[stores] get failed', e);
    res.status(500).json({ error: 'Error al obtener las tiendas' });
  }
});

export default router;
