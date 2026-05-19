import { Router } from 'express';

import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  patchAdminUser,
} from '../controllers/adminUsers/index.js';

const router = Router();

router.get('/', listAdminUsers);
router.post('/', createAdminUser);
router.patch('/:id', patchAdminUser);
router.delete('/:id', deleteAdminUser);

export default router;
