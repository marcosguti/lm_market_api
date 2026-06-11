import type { Response } from 'express';

import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middlewares/auth.js';

import { uploadDealImage } from '../../libs/filesInDigitalOcean/index.js';
import { createDeal } from '../../services/dealService.js';
import { createDealSchema, parseDealDate } from './schemas.js';

export async function createAdminDeal(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'La imagen es requerida' });
    return;
  }

  const { description, endDate, startDate } = req.body as {
    description?: string;
    endDate?: string;
    startDate?: string;
  };

  const validation = createDealSchema.validate({
    description: description || null,
    endDate: endDate ? parseDealDate(endDate) : undefined,
    startDate: startDate ? parseDealDate(startDate) : undefined,
  });

  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  try {
    const fileName = uuidv4();
    const ext = file.mimetype.split('/')[1] ?? 'jpg';
    const imageUrl = await uploadDealImage(file.buffer, file.mimetype, ext, fileName);

    const deal = await createDeal({
      description: validation.value.description ?? null,
      endDate: parseDealDate(validation.value.endDate),
      imageUrl,
      startDate: parseDealDate(validation.value.startDate),
    });

    res.status(201).json({ data: deal });
  } catch (err) {
    console.error('createAdminDeal error:', err);
    res.status(500).json({ error: 'Error al crear deal' });
  }
}
