import { Router } from 'express';

import {
  createAdminProduct,
  deleteAdminProduct,
  imageUploadMiddleware,
  listAdminProducts,
  patchAdminProduct,
} from '../controllers/adminProducts/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin', 'superAdmin']));

router.get('/', listAdminProducts);
router.post('/', imageUploadMiddleware, createAdminProduct);
router.patch('/:id', imageUploadMiddleware, patchAdminProduct);
router.delete('/:id', deleteAdminProduct);

export default router;
