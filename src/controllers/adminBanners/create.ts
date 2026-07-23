import type { Response } from 'express';

import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middlewares/auth.js';

import { uploadBannerImage } from '../../libs/filesInDigitalOcean/index.js';
import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { createBanner } from '../../services/bannerService.js';
import { createBannerSchema, normalizeDescription, parseMultipartBoolean } from './schemas.js';

export async function createAdminBanner(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'La imagen es requerida' });
    return;
  }

  const { active, description } = req.body as {
    active?: string;
    description?: string;
  };

  const parsedActive = parseMultipartBoolean(active);
  if (parsedActive === undefined) {
    res.status(400).json({ error: 'El campo active es requerido y debe ser booleano' });
    return;
  }

  const validation = createBannerSchema.validate({
    active: parsedActive,
    description: normalizeDescription(description),
  });

  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }

  try {
    const fileName = uuidv4();
    const ext = file.mimetype.split('/')[1] ?? 'jpg';
    const imageUrl = await uploadBannerImage(file.buffer, file.mimetype, ext, fileName);

    const banner = await createBanner({
      active: validation.value.active,
      description: validation.value.description ?? null,
      imageUrl,
    });

    res.status(201).json({ data: banner });
  } catch (err) {
    console.error('createAdminBanner error:', err);
    res.status(500).json({ error: 'Error al crear banner' });
  }
}
