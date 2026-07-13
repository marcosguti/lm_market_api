import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../prisma.js', () => ({
  default: {
    user: {
      count: prismaMocks.count,
      findMany: prismaMocks.findMany,
      findUnique: prismaMocks.findUnique,
      update: prismaMocks.update,
    },
  },
}));

import { findUserByPhone, updateUserByAdmin } from '../user.js';

describe('user queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findUserByPhone looks up by phone unique field', async () => {
    prismaMocks.findUnique.mockResolvedValue({ id: 'u1', phone: '04141234567' });
    const user = await findUserByPhone('04141234567');
    expect(user?.id).toBe('u1');
    expect(prismaMocks.findUnique).toHaveBeenCalledWith({ where: { phone: '04141234567' } });
  });

  it('updateUserByAdmin updates admin-editable fields', async () => {
    prismaMocks.update.mockResolvedValue({ id: 'u1', type: 'admin' });
    const result = await updateUserByAdmin('u1', {
      email: 'new@test.com',
      firstName: 'New',
      type: 'admin',
    });
    expect(result.type).toBe('admin');
    expect(prismaMocks.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@test.com',
        firstName: 'New',
        type: 'admin',
      }),
      where: { id: 'u1' },
    });
  });
});
