import { Router } from 'express';

import {
  claimOrderForDelivery,
  getDeliveryAvailableOrders,
  getMyDeliveryOrders,
  markDeliveryOrderAsDelivered,
} from '../controllers/deliveryOrderController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.get('/available', requireAuth, requireRole(['deliveryDriver']), getDeliveryAvailableOrders);
router.post('/:id/claim', requireAuth, requireRole(['deliveryDriver']), claimOrderForDelivery);
router.get('/mine', requireAuth, requireRole(['deliveryDriver']), getMyDeliveryOrders);
router.patch(
  '/:id/delivered',
  requireAuth,
  requireRole(['admin', 'superAdmin', 'deliveryDriver']),
  markDeliveryOrderAsDelivered,
);

export default router;
