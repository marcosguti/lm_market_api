import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';
import type { FileFromMulter } from '../../types/index.js';

import { createBlogArticle } from '../../services/blogArticleService.js';
import { uploadAndReplaceContentImages } from '../../utils/blogArticleContentImages.js';
import { createBlogArticleSchema, parseMultipartBoolean } from './schemas.js';

export async function createAdminBlogArticle(req: AuthRequest, res: Response): Promise<void> {
  const { active, content, title } = req.body as {
    active?: string;
    content?: string;
    title?: string;
  };

  const parsedActive = parseMultipartBoolean(active);
  if (parsedActive === undefined) {
    res.status(400).json({ error: 'El campo active es requerido y debe ser booleano' });
    return;
  }

  const validation = createBlogArticleSchema.validate({
    active: parsedActive,
    content,
    title,
  });

  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  try {
    const files = (req.files as FileFromMulter[] | undefined) ?? [];
    const finalContent = await uploadAndReplaceContentImages(validation.value.content, files);

    const blog = await createBlogArticle({
      active: validation.value.active,
      content: finalContent,
      title: validation.value.title,
    });

    res.status(201).json({ data: blog });
  } catch (err) {
    console.error('createAdminBlogArticle error:', err);
    res.status(500).json({ error: 'Error al crear artículo del blog' });
  }
}
