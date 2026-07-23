import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';
import type { FileFromMulter } from '../../types/index.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { getBlogArticleById, updateBlogArticle } from '../../services/blogArticleService.js';
import {
  deleteRemovedContentImages,
  uploadAndReplaceContentImages,
} from '../../utils/blogArticleContentImages.js';
import { getParam } from '../shared/orderHttp.js';
import { parseMultipartBoolean, updateBlogArticleSchema } from './schemas.js';

export async function patchAdminBlogArticle(req: AuthRequest, res: Response): Promise<void> {
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

  const { active, content, title } = req.body as {
    active?: string;
    content?: string;
    title?: string;
  };

  const parsedActive = parseMultipartBoolean(active);
  if (active !== undefined && active !== '' && parsedActive === undefined) {
    res.status(400).json({ error: 'El campo active debe ser booleano' });
    return;
  }

  const validation = updateBlogArticleSchema.validate({
    active: parsedActive,
    content: content === undefined || content === '' ? undefined : content,
    title: title === undefined || title === '' ? undefined : title,
  });

  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }

  try {
    const updateData: {
      active?: boolean;
      content?: string;
      title?: string;
    } = {};

    if (validation.value.active !== undefined) {
      updateData.active = validation.value.active;
    }
    if (validation.value.title !== undefined) {
      updateData.title = validation.value.title;
    }

    if (validation.value.content !== undefined) {
      const files = (req.files as FileFromMulter[] | undefined) ?? [];
      const finalContent = await uploadAndReplaceContentImages(validation.value.content, files);
      await deleteRemovedContentImages(existing.content, finalContent);
      updateData.content = finalContent;
    }

    const updated = await updateBlogArticle(id, updateData);
    res.json({ data: updated });
  } catch (err) {
    console.error('patchAdminBlogArticle error:', err);
    res.status(500).json({ error: 'Error al actualizar artículo del blog' });
  }
}
