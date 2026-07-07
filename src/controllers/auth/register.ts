import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { signAccessToken, signRefreshToken } from '../../libs/jwt.js';
import { createHash } from '../../libs/passwordHashing.js';
import { upsertLinkedDevice } from '../../queries/linkedDevice.js';
import { createToken } from '../../queries/token.js';
import { createUser, findUserByEmail, findUserByNumberId } from '../../queries/user.js';
import { registerSchema } from './schemas.js';

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const validation = registerSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const body = validation.value;

  const [existingEmail, existingNumberId] = await Promise.all([
    findUserByEmail(body.email),
    findUserByNumberId(body.numberId),
  ]);
  if (existingEmail) {
    res.status(409).json({ error: 'Email ya registrado' });
    return;
  }
  if (existingNumberId) {
    res.status(409).json({ error: 'Cédula ya registrada' });
    return;
  }

  const hashedPassword = await createHash(body.password);
  const user = await createUser({
    address: body.address || undefined,
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
    numberId: body.numberId,
    numberIdType: body.numberIdType,
    password: hashedPassword,
    phone: body.phone || undefined,
    type: body.type,
  });

  const accessToken = signAccessToken({ userId: user.id });
  const refreshToken = signRefreshToken({ userId: user.id });
  const refreshTokenHash = await createHash(refreshToken);
  await upsertLinkedDevice({
    deviceId: body.deviceId,
    refreshTokenHash,
    userId: user.id,
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await createToken({ expirationDate: expiresAt, userId: user.id });

  const { password: _p, ...userWithoutPassword } = user;
  res.status(201).json({
    accessToken,
    refreshToken,
    user: userWithoutPassword,
  });
}
