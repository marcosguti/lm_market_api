import type { Request, Response } from 'express';

import { getActiveBlogArticlesPaginated } from '../../services/blogArticleService.js';
import { paginationQuerySchema } from '../commonSchema.js';

export async function listPublicBlogArticles(req: Request, res: Response): Promise<void> {
  const validation = paginationQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  const { page, pageSize } = validation.value;

  try {
    const result = await getActiveBlogArticlesPaginated(page, pageSize);
    res.json(result);
  } catch (err) {
    console.error('listPublicBlogArticles error:', err);
    res.status(500).json({ error: 'Error al cargar el blog' });
  }
}
