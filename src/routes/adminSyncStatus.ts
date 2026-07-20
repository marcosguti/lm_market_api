import { Router } from 'express';

import { getAdminSyncStatus } from '../controllers/adminSyncStatus/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['superAdmin']));

router.get('/', getAdminSyncStatus);

export default router;
