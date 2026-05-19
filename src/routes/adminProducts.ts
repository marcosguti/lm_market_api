import { Router } from 'express';

import {
  createAdminProduct,
  deleteAdminProduct,
  listAdminProducts,
  patchAdminProduct,
} from '../controllers/adminProducts/index.js';

const router = Router();

router.get('/', listAdminProducts);
router.post('/', createAdminProduct);
router.patch('/:id', patchAdminProduct);
router.delete('/:id', deleteAdminProduct);

export default router;
