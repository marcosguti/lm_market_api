import { Router } from 'express';

import { createAdminBanner } from '../controllers/adminBanners/create.js';
import { deleteAdminBanner } from '../controllers/adminBanners/delete.js';
import { listAdminBanners } from '../controllers/adminBanners/index.js';
import { patchAdminBanner } from '../controllers/adminBanners/patch.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { bannerImageUploadMiddleware } from '../middlewares/uploadBannerImage.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin', 'superAdmin']));

router.get('/', listAdminBanners);
router.post('/', bannerImageUploadMiddleware, createAdminBanner);
router.patch('/:id', bannerImageUploadMiddleware, patchAdminBanner);
router.delete('/:id', deleteAdminBanner);

export default router;
