import type { Response } from 'express';

import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middlewares/auth.js';

import { uploadDealImage } from '../../libs/filesInDigitalOcean/index.js';
import { getDealById, updateDeal } from '../../services/dealService.js';
import { getParam } from '../shared/orderHttp.js';
import {
  parseDealDate,
  parseMultipartBoolean,
  updateDealSchema,
  validateDealDateRange,
} from './schemas.js';

export async function patchAdminDeal(req: AuthRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'El id de la oferta es requerido' });
    return;
  }

  const existing = await getDealById(id);
  if (!existing) {
    res.status(404).json({ error: 'Deal no encontrado' });
    return;
  }

  const { active, description, endDate, startDate } = req.body as {
    active?: string;
    description?: string;
    endDate?: string;
    startDate?: string;
  };

  const validation = updateDealSchema.validate({
    active: parseMultipartBoolean(active),
    description: description ?? undefined,
    endDate: endDate ? parseDealDate(endDate) : undefined,
    startDate: startDate ? parseDealDate(startDate) : undefined,
  });

  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  const nextStartDate = validation.value.startDate ?? parseDealDate(existing.startDate);
  const nextEndDate = validation.value.endDate ?? parseDealDate(existing.endDate);
  const rangeError = validateDealDateRange(nextStartDate, nextEndDate, {
    requireStartFromToday: validation.value.startDate !== undefined,
  });
  if (rangeError) {
    res.status(400).json({ error: rangeError });
    return;
  }

  try {
    let imageUrl = existing.imageUrl;

    if (req.file) {
      const fileName = uuidv4();
      const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
      imageUrl = await uploadDealImage(req.file.buffer, req.file.mimetype, ext, fileName);
    }

    const updateData: {
      active?: boolean;
      description?: null | string;
      endDate?: Date;
      imageUrl?: string;
      startDate?: Date;
    } = {};

    if (validation.value.active !== undefined) {
      updateData.active = validation.value.active;
    }
    if (validation.value.description !== undefined) {
      updateData.description = validation.value.description;
    }
    if (validation.value.startDate !== undefined) {
      updateData.startDate = parseDealDate(validation.value.startDate);
    }
    if (validation.value.endDate !== undefined) {
      updateData.endDate = parseDealDate(validation.value.endDate);
    }
    if (req.file) {
      updateData.imageUrl = imageUrl;
    }

    const updated = await updateDeal(id, updateData);
    res.json({ data: updated });
  } catch (err) {
    console.error('patchAdminDeal error:', err);
    res.status(500).json({ error: 'Error al actualizar deal' });
  }
}
