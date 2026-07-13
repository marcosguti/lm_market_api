import { beforeEach, describe, expect, it, vi } from 'vitest';

const createHash = vi.hoisted(() => vi.fn().mockResolvedValue('hashed-token'));

vi.mock('../../libs/passwordHashing.js', () => ({
  createHash: (...args: unknown[]) => createHash(...args),
}));

const prismaMock = vi.hoisted(() => ({
  linkedDevice: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({ default: prismaMock }));

import {
  findLinkedDeviceByUserIdAndDeviceId,
  revokeLinkedDevice,
  updateLinkedDeviceRefreshTokenHash,
  upsertLinkedDevice,
} from '../linkedDevice.js';

describe('linkedDevice queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createHash.mockResolvedValue('hashed-token');
  });

  it('findLinkedDeviceByUserIdAndDeviceId uses composite key', async () => {
    prismaMock.linkedDevice.findUnique.mockResolvedValue({ deviceId: 'd1' });
    const result = await findLinkedDeviceByUserIdAndDeviceId('u1', 'd1');
    expect(result?.deviceId).toBe('d1');
  });

  it('updateLinkedDeviceRefreshTokenHash hashes refresh token', async () => {
    prismaMock.linkedDevice.update.mockResolvedValue({});
    await updateLinkedDeviceRefreshTokenHash('u1', 'd1', 'refresh-token');
    expect(createHash).toHaveBeenCalledWith('refresh-token');
    expect(prismaMock.linkedDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { refreshTokenHash: 'hashed-token' } }),
    );
  });

  it('revokeLinkedDevice sets revoked prefix', async () => {
    prismaMock.linkedDevice.update.mockResolvedValue({});
    await revokeLinkedDevice('u1', 'd1');
    expect(prismaMock.linkedDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refreshTokenHash: expect.stringMatching(/^revoked:/),
        }),
      }),
    );
  });

  it('upsertLinkedDevice creates or updates device', async () => {
    prismaMock.linkedDevice.upsert.mockResolvedValue({ id: 'ld1' });
    const result = await upsertLinkedDevice({
      deviceId: 'd1',
      refreshTokenHash: 'hash',
      userId: 'u1',
    });
    expect(result.id).toBe('ld1');
  });
});
