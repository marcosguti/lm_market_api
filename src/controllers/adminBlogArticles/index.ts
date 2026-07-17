import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { getAllBlogArticles } from '../../services/blogArticleService.js';

export async function listAdminBlogArticles(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const blogs = await getAllBlogArticles();
    res.json({ data: blogs });
  } catch (err) {
    console.error('listAdminBlogArticles error:', err);
    res.status(500).json({ error: 'Error al cargar blogs' });
  }
}
