import { Router } from 'express';

import {
  confirmOrderPayment,
  getCart,
  getOrderById,
  getOrderHistory,
  patchCartLines,
} from '../controllers/orders/index.js';
import { requireAuth } from '../middlewares/auth.js';
import { paymentScreenshotUploadMiddleware } from '../middlewares/uploadPaymentScreenshot.js';

const router = Router();

router.get('/cart', requireAuth, getCart);
router.get('/history', requireAuth, getOrderHistory);
router.get('/:id', requireAuth, getOrderById);
router.patch('/:id/lines', requireAuth, patchCartLines);
router.post(
  '/:id/confirm-payment',
  requireAuth,
  paymentScreenshotUploadMiddleware,
  confirmOrderPayment,
);

export default router;
