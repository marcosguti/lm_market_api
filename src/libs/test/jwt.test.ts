import { afterEach, describe, expect, it, vi } from 'vitest';

describe('jwt', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('signs and verifies access and refresh tokens', async () => {
    vi.stubEnv('JWT_SECRET', 'test-secret-key');
    vi.stubEnv('JWT_EXPIRES_IN', '1h');
    vi.stubEnv('REFRESH_TOKEN_EXPIRES_IN', '7d');
    const { signAccessToken, signRefreshToken, verifyToken } = await import('../jwt.js');

    const access = signAccessToken({ userId: 'u1' });
    const refresh = signRefreshToken({ userId: 'u1' });

    expect(verifyToken(access).userId).toBe('u1');
    expect(verifyToken(refresh).userId).toBe('u1');
  });
});
