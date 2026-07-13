import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  token: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({ default: prismaMock }));

import { createToken, deleteTokensByUserId, findTokenById } from '../token.js';

describe('token queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createToken stores expiration and userId', async () => {
    const expires = new Date();
    prismaMock.token.create.mockResolvedValue({ id: 't1' });
    const result = await createToken({ expirationDate: expires, userId: 'u1' });
    expect(result.id).toBe('t1');
  });

  it('deleteTokensByUserId returns deleted count', async () => {
    prismaMock.token.deleteMany.mockResolvedValue({ count: 3 });
    expect(await deleteTokensByUserId('u1')).toBe(3);
  });

  it('findTokenById looks up by id', async () => {
    prismaMock.token.findUnique.mockResolvedValue({ id: 't1' });
    expect(await findTokenById('t1')).toEqual({ id: 't1' });
  });
});
