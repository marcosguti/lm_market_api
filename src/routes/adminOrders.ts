import { Router } from 'express';

import {
  assignDelivery,
  getKitchenOrders,
  getOrderStatusHistory,
  patchAdminOrderStatus,
  unassignDelivery,
  verifyPayment,
} from '../controllers/adminOrders/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.get('/kitchen', requireAuth, requireRole(['admin', 'superAdmin']), getKitchenOrders);
router.get(
  '/:id/status-history',
  requireAuth,
  requireRole(['admin', 'superAdmin']),
  getOrderStatusHistory,
);
router.patch(
  '/:id/status',
  requireAuth,
  requireRole(['admin', 'superAdmin']),
  patchAdminOrderStatus,
);
router.post(
  '/:id/assign-delivery',
  requireAuth,
  requireRole(['admin', 'superAdmin']),
  assignDelivery,
);
router.post(
  '/:id/unassign-delivery',
  requireAuth,
  requireRole(['admin', 'superAdmin']),
  unassignDelivery,
);
router.patch(
  '/:id/verify-payment',
  requireAuth,
  requireRole(['admin', 'superAdmin']),
  verifyPayment,
);

export default router;
