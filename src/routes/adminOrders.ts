import { Router } from 'express';

import { getKitchenOrders, patchAdminOrderStatus } from '../controllers/adminOrders/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.get('/kitchen', requireAuth, requireRole(['admin', 'superAdmin']), getKitchenOrders);
router.patch(
  '/:id/status',
  requireAuth,
  requireRole(['admin', 'superAdmin']),
  patchAdminOrderStatus,
);

export default router;
