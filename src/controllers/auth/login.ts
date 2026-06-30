import type { Request, Response } from 'express';

import { signAccessToken, signRefreshToken } from '../../libs/jwt.js';
import { comparePassword, createHash } from '../../libs/passwordHashing.js';
import { upsertLinkedDevice } from '../../queries/linkedDevice.js';
import { createToken } from '../../queries/token.js';
import { findUserByEmail } from '../../queries/user.js';
import { loginSchema } from './schemas.js';

export async function login(req: Request, res: Response): Promise<void> {
  const validation = loginSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { deviceId, email, password } = validation.value;

  const user = await findUserByEmail(email);
  if (!user || !(await comparePassword(password, user.password))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const accessToken = signAccessToken({ userId: user.id });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await createToken({ expirationDate: expiresAt, userId: user.id });

  const refreshToken = signRefreshToken({ userId: user.id });
  const refreshTokenHash = await createHash(refreshToken);
  await upsertLinkedDevice({
    deviceId,
    refreshTokenHash,
    userId: user.id,
  });

  const { password: _p, ...userWithoutPassword } = user;
  res.json({
    accessToken,
    refreshToken,
    user: userWithoutPassword,
  });
}
