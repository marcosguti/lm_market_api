import { Router } from 'express';

import { createAdminBlogArticle } from '../controllers/adminBlogArticles/create.js';
import { deleteAdminBlogArticle } from '../controllers/adminBlogArticles/delete.js';
import { listAdminBlogArticles } from '../controllers/adminBlogArticles/index.js';
import { patchAdminBlogArticle } from '../controllers/adminBlogArticles/patch.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { blogArticleContentImagesUploadMiddleware } from '../middlewares/uploadBlogArticleContentImages.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin', 'superAdmin']));

router.get('/', listAdminBlogArticles);
router.post('/', blogArticleContentImagesUploadMiddleware, createAdminBlogArticle);
router.patch('/:id', blogArticleContentImagesUploadMiddleware, patchAdminBlogArticle);
router.delete('/:id', deleteAdminBlogArticle);

export default router;
