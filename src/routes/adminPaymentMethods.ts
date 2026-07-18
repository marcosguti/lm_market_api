import { Router } from 'express';

import {
  listAdminPaymentMethods,
  patchAdminPaymentMethod,
} from '../controllers/adminPaymentMethods/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['superAdmin']));

router.get('/', listAdminPaymentMethods);
router.patch('/:method', patchAdminPaymentMethod);

export default router;
