import { Router } from 'express';

import {
  createAdminProduct,
  deleteAdminProduct,
  imageUploadMiddleware,
  listAdminProducts,
  patchAdminProduct,
} from '../controllers/adminProducts/index.js';

const router = Router();

router.get('/', listAdminProducts);
router.post('/', imageUploadMiddleware, createAdminProduct);
router.patch('/:id', imageUploadMiddleware, patchAdminProduct);
router.delete('/:id', deleteAdminProduct);

export default router;
