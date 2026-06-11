import { Router } from 'express';

import { getActiveDealsHandler } from '../controllers/deals/index.js';

const router = Router();

router.get('/', getActiveDealsHandler);

export default router;
