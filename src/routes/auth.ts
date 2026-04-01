import { Router } from 'express';

import {
  changePassword,
  getMe,
  login,
  refresh,
  register,
  requestPasswordReset,
  resetPassword,
  updateProfile,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/recover-password/request', requestPasswordReset);
router.post('/recover-password/reset', resetPassword);
router.post('/refresh', refresh);

router.get('/me', requireAuth, getMe);
router.patch('/cuenta', requireAuth, updateProfile);
router.post('/cambiar-password', requireAuth, changePassword);

export default router;
