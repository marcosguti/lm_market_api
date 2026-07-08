import type { User } from '@prisma/client';

import { signAccessToken, signRefreshToken } from '../../libs/jwt.js';
import { createHash } from '../../libs/passwordHashing.js';
import { upsertLinkedDevice } from '../../queries/linkedDevice.js';
import { createToken } from '../../queries/token.js';

export async function issueAuthSession(
  user: User,
  deviceId: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'password'>;
}> {
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
  return {
    accessToken,
    refreshToken,
    user: userWithoutPassword,
  };
}
