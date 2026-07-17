import { Router } from 'express';

import {
  confirmOrderPayment,
  getCart,
  getOrderById,
  getOrderHistory,
  patchCartLines,
  verifyMobilePayment,
} from '../controllers/orders/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { paymentScreenshotUploadMiddleware } from '../middlewares/uploadPaymentScreenshot.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['client']));

router.get('/cart', getCart);
router.get('/history', getOrderHistory);
router.get('/:id', getOrderById);
router.patch('/:id/lines', patchCartLines);
router.post('/:id/confirm-payment', paymentScreenshotUploadMiddleware, confirmOrderPayment);
router.post('/:id/verify-mobile-payment', verifyMobilePayment);

export default router;
