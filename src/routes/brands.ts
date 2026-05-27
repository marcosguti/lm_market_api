import { Router } from 'express';

import { getBrands } from '../controllers/catalog/getBrands.js';

const router = Router();

router.get('/', getBrands);

export default router;
