import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findLinkedDeviceByUserIdAndDeviceId = vi.fn();
const revokeLinkedDevice = vi.fn();
const updateLinkedDeviceRefreshTokenHash = vi.fn();
const upsertLinkedDevice = vi.fn();
const findUserById = vi.fn();

vi.mock('../../../queries/linkedDevice.js', () => ({
  findLinkedDeviceByUserIdAndDeviceId: (...args: unknown[]) =>
    findLinkedDeviceByUserIdAndDeviceId(...args),
  revokeLinkedDevice: (...args: unknown[]) => revokeLinkedDevice(...args),
  updateLinkedDeviceRefreshTokenHash: (...args: unknown[]) =>
    updateLinkedDeviceRefreshTokenHash(...args),
  upsertLinkedDevice: (...args: unknown[]) => upsertLinkedDevice(...args),
}));

vi.mock('../../../queries/user.js', () => ({
  findUserById: (...args: unknown[]) => findUserById(...args),
}));

vi.mock('../../../libs/jwt.js', () => ({
  signAccessToken: vi.fn(() => 'new-access'),
  signRefreshToken: vi.fn(() => 'new-refresh'),
  verifyToken: vi.fn(() => ({ userId: 'u1' })),
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  comparePassword: vi.fn(),
}));

import { comparePassword } from '../../../libs/passwordHashing.js';
import { refresh } from '../refresh.js';

function mockRes(): Response & { statusCode: number; body?: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body?: unknown };
}

describe('refresh controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findLinkedDeviceByUserIdAndDeviceId.mockResolvedValue({
      refreshTokenHash: 'stored-hash',
    });
    vi.mocked(comparePassword).mockResolvedValue(true);
    findUserById.mockResolvedValue({ id: 'u1', emailVerified: true });
    updateLinkedDeviceRefreshTokenHash.mockResolvedValue(undefined);
  });

  it('returns 400 for invalid body', async () => {
    const req = { body: {} } as never;
    const res = mockRes();
    await refresh(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns new tokens on success', async () => {
    const req = { body: { deviceId: 'd1', refreshToken: 'token' } } as never;
    const res = mockRes();
    await refresh(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('upserts linked device when update fails concurrently', async () => {
    updateLinkedDeviceRefreshTokenHash
      .mockRejectedValueOnce(new Error('row missing'))
      .mockResolvedValueOnce(undefined);
    const req = { body: { deviceId: 'd1', refreshToken: 'token' } } as never;
    const res = mockRes();
    await refresh(req, res);
    expect(upsertLinkedDevice).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
