import { Router } from 'express';

import { getPaymentBanks, getPaymentConfig } from '../controllers/payments/index.js';

const router = Router();

router.get('/banks', getPaymentBanks);
router.get('/config', getPaymentConfig);

export default router;
