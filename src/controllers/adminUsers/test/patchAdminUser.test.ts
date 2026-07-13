import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { patchAdminUser } from '../patchAdminUser.js';

const findUserByEmail = vi.fn();
const findUserById = vi.fn();
const findUserByNumberId = vi.fn();
const findUserByPhone = vi.fn();
const updateUserByAdmin = vi.fn();

vi.mock('../../../queries/user.js', () => ({
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
  findUserById: (...args: unknown[]) => findUserById(...args),
  findUserByNumberId: (...args: unknown[]) => findUserByNumberId(...args),
  findUserByPhone: (...args: unknown[]) => findUserByPhone(...args),
  updateUserByAdmin: (...args: unknown[]) => updateUserByAdmin(...args),
}));

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

describe('patchAdminUser controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUserById.mockResolvedValue({
      id: 'u1',
      email: 'old@test.com',
      numberId: '111',
      phone: null,
      type: 'client',
      firstName: 'Old',
      lastName: 'User',
      numberIdType: 'V',
      password: 'hash',
      address: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    });
    findUserByEmail.mockResolvedValue(null);
    findUserByNumberId.mockResolvedValue(null);
    findUserByPhone.mockResolvedValue(null);
    updateUserByAdmin.mockResolvedValue({
      id: 'u1',
      email: 'new@test.com',
      numberId: '111',
      phone: null,
      type: 'client',
      firstName: 'New',
      lastName: 'User',
      numberIdType: 'V',
      password: 'hash',
      address: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    });
  });

  it('returns 404 when user does not exist', async () => {
    findUserById.mockResolvedValue(null);
    const req = { body: { firstName: 'X' }, params: { id: 'missing' } } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when email is taken by another user', async () => {
    findUserByEmail.mockResolvedValue({ id: 'other' });
    const req = {
      body: { email: 'taken@test.com' },
      params: { id: 'u1' },
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(409);
  });

  it('updates user on valid patch', async () => {
    const req = {
      body: { firstName: 'New', email: 'new@test.com' },
      params: { id: 'u1' },
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(200);
    expect(updateUserByAdmin).toHaveBeenCalled();
  });
});
