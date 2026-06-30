import type { Request, Response } from 'express';

import { signAccessToken, signRefreshToken, verifyToken } from '../../libs/jwt.js';
import { comparePassword } from '../../libs/passwordHashing.js';
import {
  findLinkedDeviceByUserIdAndDeviceId,
  revokeLinkedDevice,
  updateLinkedDeviceRefreshTokenHash,
  upsertLinkedDevice,
} from '../../queries/linkedDevice.js';
import { refreshSchema } from './schemas.js';

const REVOKED_PREFIX = 'revoked:';

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

  const linked = await findLinkedDeviceByUserIdAndDeviceId(payload.userId, deviceId);
  if (!linked) {
    res.status(401).json({ error: 'Invalid device or refresh token' });
    return;
  }

  // Reuse detection: if the stored hash has been revoked OR doesn't match the
  // incoming token, an attacker may be trying to use a stolen token after
  // a legitimate rotation. Revoke the entire device chain.
  if (linked.refreshTokenHash.startsWith(REVOKED_PREFIX)) {
    res.status(401).json({ error: 'Refresh token revoked' });
    return;
  }

  const matches = await comparePassword(refreshToken, linked.refreshTokenHash);
  if (!matches) {
    // Token mismatch: probable reuse of an old, already-rotated refresh token.
    // Revoke the whole device to invalidate any other outstanding tokens.
    await revokeLinkedDevice(payload.userId, deviceId);
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  // Mint new tokens (rotation)
  const newAccessToken = signAccessToken({ userId: payload.userId });
  const newRefreshToken = signRefreshToken({ userId: payload.userId });

  // Persist the new refresh token hash. The old token is now invalid.
  try {
    await updateLinkedDeviceRefreshTokenHash(payload.userId, deviceId, newRefreshToken);
  } catch {
    // Device row was deleted concurrently; re-upsert it so the new token works.
    await upsertLinkedDevice({
      deviceId,
      // Reuse a sentinel because the actual hash will be regenerated; this
      // path only triggers if the row was deleted between the SELECT above
      // and the UPDATE here.
      refreshTokenHash: '__pending__',
      userId: payload.userId,
    });
    await updateLinkedDeviceRefreshTokenHash(payload.userId, deviceId, newRefreshToken);
  }

  res.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
}
