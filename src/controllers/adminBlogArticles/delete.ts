import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { deleteBlogArticle, getBlogArticleById } from '../../services/blogArticleService.js';
import { deleteAllContentImages } from '../../utils/blogArticleContentImages.js';
import { getParam } from '../shared/orderHttp.js';

export async function deleteAdminBlogArticle(req: AuthRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'El id del artículo es requerido' });
    return;
  }

  const existing = await getBlogArticleById(id);
  if (!existing) {
    res.status(404).json({ error: 'Artículo no encontrado' });
    return;
  }

  try {
    await deleteAllContentImages(existing.content);
    await deleteBlogArticle(id);
    res.json({ message: 'Artículo eliminado' });
  } catch (err) {
    console.error('deleteAdminBlogArticle error:', err);
    res.status(500).json({ error: 'Error al eliminar artículo del blog' });
  }
}
