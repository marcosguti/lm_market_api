import { Router } from 'express';

import {
  getKitchenOrders,
  patchAdminOrderStatus,
  verifyPayment,
} from '../controllers/adminOrders/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.get('/kitchen', requireAuth, requireRole(['admin', 'superAdmin']), getKitchenOrders);
router.patch(
  '/:id/status',
  requireAuth,
  requireRole(['admin', 'superAdmin']),
  patchAdminOrderStatus,
);
router.patch(
  '/:id/verify-payment',
  requireAuth,
  requireRole(['admin', 'superAdmin']),
  verifyPayment,
);

export default router;
