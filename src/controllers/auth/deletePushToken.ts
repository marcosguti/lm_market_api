import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { deletePushDevice } from '../../services/pushDeviceService.js';
import { deletePushTokenSchema } from './schemas.js';

export async function deletePushToken(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const validation = deletePushTokenSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }

  await deletePushDevice({
    token: validation.value.token,
    userId: req.userId,
  });

  res.json({ ok: true });
}
