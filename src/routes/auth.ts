import { Router } from 'express';

import {
  changePassword,
  getMe,
  login,
  logout,
  refresh,
  register,
  requestPasswordReset,
  resetPassword,
  sendLoginCode,
  sendVerificationCode,
  updateProfile,
  validatePasswordResetTokenHandler,
  verifyEmail,
  verifyLoginCodeHandler,
} from '../controllers/auth/index.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/login-code/send', sendLoginCode);
router.post('/login-code/verify', verifyLoginCodeHandler);
router.post('/logout', requireAuth, logout);
router.post('/recover-password/request', requestPasswordReset);
router.get('/recover-password/validate', validatePasswordResetTokenHandler);
router.post('/recover-password/reset', resetPassword);
router.post('/verify-email/send', sendVerificationCode);
router.post('/verify-email', verifyEmail);
router.post('/refresh', refresh);

router.get('/me', requireAuth, getMe);
router.patch('/cuenta', requireAuth, updateProfile);
router.post('/cambiar-password', requireAuth, changePassword);

export default router;
