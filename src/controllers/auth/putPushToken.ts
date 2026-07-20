import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { upsertPushDevice } from '../../services/pushDeviceService.js';
import { putPushTokenSchema } from './schemas.js';

export async function putPushToken(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const validation = putPushTokenSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  await upsertPushDevice({
    platform: validation.value.platform,
    token: validation.value.token,
    userId: req.userId,
  });

  res.json({ ok: true });
}
