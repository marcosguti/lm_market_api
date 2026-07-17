import { Router } from 'express';

import { getPublicBlogArticleById } from '../controllers/blogArticles/getById.js';
import { listPublicBlogArticles } from '../controllers/blogArticles/list.js';

const router = Router();

router.get('/', listPublicBlogArticles);
router.get('/:id', getPublicBlogArticleById);

export default router;
