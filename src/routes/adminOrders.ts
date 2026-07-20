import { Router } from 'express';

import {
  assignDelivery,
  getAdminOrderTracking,
  getKitchenOrders,
  getOrderDeliveryDrivers,
  getOrderStatusHistory,
  patchAdminOrderStatus,
  unassignDelivery,
  verifyPayment,
} from '../controllers/adminOrders/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { requireAdminHasStore } from '../middlewares/storeScope.js';

const router = Router();

const adminOrderRoles = requireRole(['admin', 'superAdmin']);
const adminWithStore = [requireAuth, adminOrderRoles, requireAdminHasStore] as const;

router.get('/kitchen', requireAuth, adminOrderRoles, getKitchenOrders);
router.get('/:id/delivery-drivers', ...adminWithStore, getOrderDeliveryDrivers);
router.get('/:id/status-history', ...adminWithStore, getOrderStatusHistory);
router.get('/:id/tracking', ...adminWithStore, getAdminOrderTracking);
router.patch('/:id/status', ...adminWithStore, patchAdminOrderStatus);
router.post('/:id/assign-delivery', ...adminWithStore, assignDelivery);
router.post('/:id/unassign-delivery', ...adminWithStore, unassignDelivery);
router.patch('/:id/verify-payment', ...adminWithStore, verifyPayment);

export default router;
