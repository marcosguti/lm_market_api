import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { findUserByPhone, updateUser } from '../../queries/user.js';
import { updateProfileSchema } from './schemas.js';
import { serializeAuthUser } from './serializeAuthUser.js';

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  const validation = updateProfileSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }
  const body = validation.value;

  if (body.phone) {
    const existingPhone = await findUserByPhone(body.phone);
    if (existingPhone && existingPhone.id !== req.userId) {
      res.status(409).json({ error: 'Teléfono ya registrado' });
      return;
    }
  }

  const user = await updateUser(req.userId, {
    address: body.address,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
  });
  res.json({ user: serializeAuthUser(user) });
}
