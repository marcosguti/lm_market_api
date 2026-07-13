import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  create: vi.fn(),
  deleteMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../prisma.js', () => ({
  default: {
    emailVerificationCode: {
      create: prismaMocks.create,
      deleteMany: prismaMocks.deleteMany,
      findFirst: prismaMocks.findFirst,
      update: prismaMocks.update,
    },
  },
}));

import {
  createEmailVerificationCode,
  deleteEmailVerificationCodesByUserId,
  findLatestEmailVerificationCodeByUserId,
  incrementEmailVerificationFailedAttempts,
} from '../emailVerificationCode.js';

describe('emailVerificationCode queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createEmailVerificationCode persists code', async () => {
    const expiresAt = new Date();
    prismaMocks.create.mockResolvedValue({ id: 'c1' });

    await createEmailVerificationCode({
      codeHash: 'hash',
      expiresAt,
      purpose: 'email_verification',
      userId: 'u1',
    });

    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: {
        codeHash: 'hash',
        expiresAt,
        purpose: 'email_verification',
        userId: 'u1',
      },
    });
  });

  it('deleteEmailVerificationCodesByUserId deletes by user and optional purpose', async () => {
    await deleteEmailVerificationCodesByUserId('u1', 'email_verification');
    expect(prismaMocks.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', purpose: 'email_verification' },
    });
  });

  it('findLatestEmailVerificationCodeByUserId queries latest code', async () => {
    prismaMocks.findFirst.mockResolvedValue({ id: 'c1' });
    const result = await findLatestEmailVerificationCodeByUserId('u1', 'login_code');
    expect(result).toEqual({ id: 'c1' });
    expect(prismaMocks.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: { purpose: 'login_code', userId: 'u1' },
    });
  });

  it('incrementEmailVerificationFailedAttempts increments counter', async () => {
    prismaMocks.update.mockResolvedValue({ id: 'c1', failedAttempts: 2 });
    const result = await incrementEmailVerificationFailedAttempts('c1');
    expect(result.failedAttempts).toBe(2);
    expect(prismaMocks.update).toHaveBeenCalledWith({
      data: { failedAttempts: { increment: 1 } },
      where: { id: 'c1' },
    });
  });
});
