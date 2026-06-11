import { Router } from 'express';

import { createAdminDeal } from '../controllers/adminDeals/create.js';
import { deleteAdminDeal } from '../controllers/adminDeals/delete.js';
import { listAdminDeals } from '../controllers/adminDeals/index.js';
import { patchAdminDeal } from '../controllers/adminDeals/patch.js';
import { requireAuth } from '../middlewares/auth.js';
import { dealImageUploadMiddleware } from '../middlewares/uploadDealImage.js';

const router = Router();

router.use(requireAuth);

router.get('/', listAdminDeals);
router.post('/', dealImageUploadMiddleware, createAdminDeal);
router.patch('/:id', dealImageUploadMiddleware, patchAdminDeal);
router.delete('/:id', deleteAdminDeal);

export default router;
