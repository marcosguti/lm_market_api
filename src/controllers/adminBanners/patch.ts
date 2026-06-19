import type { Response } from 'express';

import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middlewares/auth.js';

import { uploadBannerImage } from '../../libs/filesInDigitalOcean/index.js';
import { getBannerById, updateBanner } from '../../services/bannerService.js';
import { getParam } from '../shared/orderHttp.js';
import { normalizeDescription, parseMultipartBoolean, updateBannerSchema } from './schemas.js';

export async function patchAdminBanner(req: AuthRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Banner id is required' });
    return;
  }

  const existing = await getBannerById(id);
  if (!existing) {
    res.status(404).json({ error: 'Banner no encontrado' });
    return;
  }

  const { active, description } = req.body as {
    active?: string;
    description?: string;
  };

  const parsedActive = parseMultipartBoolean(active);
  if (active !== undefined && active !== '' && parsedActive === undefined) {
    res.status(400).json({ error: 'El campo active debe ser booleano' });
    return;
  }

  const validation = updateBannerSchema.validate({
    active: parsedActive,
    description: normalizeDescription(description),
  });

  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  try {
    let imageUrl = existing.imageUrl;

    if (req.file) {
      const fileName = uuidv4();
      const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
      imageUrl = await uploadBannerImage(req.file.buffer, req.file.mimetype, ext, fileName);
    }

    const updateData: {
      active?: boolean;
      description?: null | string;
      imageUrl?: string;
    } = {};

    if (validation.value.active !== undefined) {
      updateData.active = validation.value.active;
    }
    if (validation.value.description !== undefined) {
      updateData.description = validation.value.description;
    }
    if (req.file) {
      updateData.imageUrl = imageUrl;
    }

    const updated = await updateBanner(id, updateData);
    res.json({ data: updated });
  } catch (err) {
    console.error('patchAdminBanner error:', err);
    res.status(500).json({ error: 'Error al actualizar banner' });
  }
}
