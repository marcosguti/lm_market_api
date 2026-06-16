import { Router } from 'express';

import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  patchAdminUser,
} from '../controllers/adminUsers/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin', 'superAdmin']));

router.get('/', listAdminUsers);
router.post('/', createAdminUser);
router.patch('/:id', patchAdminUser);
router.delete('/:id', deleteAdminUser);

export default router;
