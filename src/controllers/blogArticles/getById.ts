import type { Request, Response } from 'express';

import { getActiveBlogArticleById } from '../../services/blogArticleService.js';
import { getParam } from '../shared/orderHttp.js';

export async function getPublicBlogArticleById(req: Request, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'El id del artículo es requerido' });
    return;
  }

  try {
    const blog = await getActiveBlogArticleById(id);
    if (!blog) {
      res.status(404).json({ error: 'Artículo no encontrado' });
      return;
    }
    res.json({ data: blog });
  } catch (err) {
    console.error('getPublicBlogArticleById error:', err);
    res.status(500).json({ error: 'Error al cargar el artículo' });
  }
}
