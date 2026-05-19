import { Router } from 'express';

import {
  confirmOrderPayment,
  getCart,
  getOrderById,
  getOrderHistory,
  patchCartLines,
} from '../controllers/orders/index.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/cart', requireAuth, getCart);
router.get('/history', requireAuth, getOrderHistory);
router.get('/:id', requireAuth, getOrderById);
router.patch('/:id/lines', requireAuth, patchCartLines);
router.post('/:id/confirm-payment', requireAuth, confirmOrderPayment);

export default router;
