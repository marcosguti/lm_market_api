import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  passwordResetToken: {
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({ default: prismaMock }));

import {
  createPasswordResetToken,
  deletePasswordResetToken,
  deletePasswordResetTokensByUserId,
  findPasswordResetTokenByToken,
} from '../passwordResetToken.js';

describe('passwordResetToken queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createPasswordResetToken persists token', async () => {
    prismaMock.passwordResetToken.create.mockResolvedValue({ token: 'tok' });
    const result = await createPasswordResetToken({
      expiresAt: new Date(),
      token: 'tok',
      userId: 'u1',
    });
    expect(result.token).toBe('tok');
  });

  it('findPasswordResetTokenByToken includes user', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({ token: 'tok' });
    await findPasswordResetTokenByToken('tok');
    expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ include: { user: true } }),
    );
  });

  it('delete helpers remove tokens', async () => {
    prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    await deletePasswordResetTokensByUserId('u1');
    await deletePasswordResetToken('tok');
    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalled();
    expect(prismaMock.passwordResetToken.delete).toHaveBeenCalledWith({ where: { token: 'tok' } });
  });
});
