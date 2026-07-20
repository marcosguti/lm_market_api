import { Router } from 'express';

import { getSyncHealth } from '../controllers/health/index.js';

const router = Router();

router.get('/sync', getSyncHealth);

export default router;
