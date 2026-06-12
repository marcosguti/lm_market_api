import { Router } from 'express';

import { findStores } from '../queries/store.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const stores = await findStores();
    res.json(stores);
  } catch (e) {
    console.error('[stores] get failed', e);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

export default router;
