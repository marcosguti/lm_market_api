import { Router } from 'express';

import { getActiveBannersHandler } from '../controllers/banners/index.js';

const router = Router();

router.get('/', getActiveBannersHandler);

export default router;
