import type { Request, Response } from 'express';

import { signAccessToken, verifyToken } from '../../libs/jwt.js';
import { comparePassword } from '../../libs/passwordHashing.js';
import { findLinkedDeviceByUserIdAndDeviceId } from '../../queries/linkedDevice.js';
import { refreshSchema } from './schemas.js';

export async function refresh(req: Request, res: Response): Promise<void> {
  const validation = refreshSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { deviceId, refreshToken } = validation.value;

  let payload: { userId: string };
  try {
    payload = verifyToken(refreshToken);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  if (deviceId) {
    const linked = await findLinkedDeviceByUserIdAndDeviceId(payload.userId, deviceId);
    if (!linked || !(await comparePassword(refreshToken, linked.refreshTokenHash))) {
      res.status(401).json({ error: 'Invalid device or refresh token' });
      return;
    }
  }

  const accessToken = signAccessToken({ userId: payload.userId });
  res.json({ accessToken });
}
