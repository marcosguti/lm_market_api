import { Router } from 'express';

import { getDepartments } from '../controllers/catalog/getDepartments.js';

const router = Router();

router.get('/', getDepartments);

export default router;
