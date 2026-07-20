import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { patchAdminUser } from '../patchAdminUser.js';

const findUserByEmail = vi.fn();
const findUserById = vi.fn();
const findUserByNumberId = vi.fn();
const findUserByPhone = vi.fn();
const updateUserByAdmin = vi.fn();
const assertStoreActive = vi.fn();

vi.mock('../../../queries/user.js', () => ({
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
  findUserById: (...args: unknown[]) => findUserById(...args),
  findUserByNumberId: (...args: unknown[]) => findUserByNumberId(...args),
  findUserByPhone: (...args: unknown[]) => findUserByPhone(...args),
  updateUserByAdmin: (...args: unknown[]) => updateUserByAdmin(...args),
}));

vi.mock('../../../queries/store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../queries/store.js')>();
  return {
    ...actual,
    assertStoreActive: (...args: unknown[]) => assertStoreActive(...args),
  };
});

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

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'old@test.com',
    numberId: '111',
    phone: null,
    type: 'client',
    storeId: null,
    firstName: 'Old',
    lastName: 'User',
    numberIdType: 'V',
    password: 'hash',
    address: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
    ...overrides,
  };
}

describe('patchAdminUser controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUserById.mockResolvedValue(baseUser());
    findUserByEmail.mockResolvedValue(null);
    findUserByNumberId.mockResolvedValue(null);
    findUserByPhone.mockResolvedValue(null);
    assertStoreActive.mockResolvedValue(undefined);
    updateUserByAdmin.mockResolvedValue(baseUser({ email: 'new@test.com', firstName: 'New' }));
  });

  it('returns 404 when user does not exist', async () => {
    findUserById.mockResolvedValue(null);
    const req = {
      body: { firstName: 'X' },
      params: { id: 'missing' },
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when email is taken by another user', async () => {
    findUserByEmail.mockResolvedValue({ id: 'other' });
    const req = {
      body: { email: 'taken@test.com' },
      params: { id: 'u1' },
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(409);
  });

  it('updates user on valid patch', async () => {
    const req = {
      body: { firstName: 'New', email: 'new@test.com' },
      params: { id: 'u1' },
      storeId: 'store-1',
      userType: 'admin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(200);
    expect(updateUserByAdmin).toHaveBeenCalled();
  });

  it('returns 403 when admin tries to set storeId', async () => {
    const req = {
      body: { storeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      params: { id: 'u1' },
      storeId: 'store-1',
      userType: 'admin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(403);
    expect(updateUserByAdmin).not.toHaveBeenCalled();
  });

  it('returns 403 when admin edits deliveryDriver of another store', async () => {
    findUserById.mockResolvedValue(
      baseUser({ id: 'driver-other', storeId: 'store-2', type: 'deliveryDriver' }),
    );
    const req = {
      body: { firstName: 'Hacked' },
      params: { id: 'driver-other' },
      storeId: 'store-1',
      userType: 'admin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(403);
    expect(updateUserByAdmin).not.toHaveBeenCalled();
  });

  it('returns 403 when admin without store edits a deliveryDriver', async () => {
    findUserById.mockResolvedValue(
      baseUser({ id: 'driver-1', storeId: 'store-1', type: 'deliveryDriver' }),
    );
    const req = {
      body: { firstName: 'NoStore' },
      params: { id: 'driver-1' },
      storeId: null,
      userType: 'admin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(403);
    expect(updateUserByAdmin).not.toHaveBeenCalled();
  });

  it('returns 403 when admin edits deliveryDriver with null storeId', async () => {
    findUserById.mockResolvedValue(
      baseUser({ id: 'driver-orphan', storeId: null, type: 'deliveryDriver' }),
    );
    const req = {
      body: { firstName: 'Orphan' },
      params: { id: 'driver-orphan' },
      storeId: 'store-1',
      userType: 'admin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(403);
    expect(updateUserByAdmin).not.toHaveBeenCalled();
  });

  it('allows admin to edit deliveryDriver of their own store', async () => {
    findUserById.mockResolvedValue(
      baseUser({ id: 'driver-1', storeId: 'store-1', type: 'deliveryDriver' }),
    );
    updateUserByAdmin.mockResolvedValue(
      baseUser({
        firstName: 'Updated',
        id: 'driver-1',
        storeId: 'store-1',
        type: 'deliveryDriver',
      }),
    );
    const req = {
      body: { firstName: 'Updated' },
      params: { id: 'driver-1' },
      storeId: 'store-1',
      userType: 'admin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(200);
    expect(updateUserByAdmin).toHaveBeenCalled();
  });

  it('returns 403 when admin tries to edit another admin', async () => {
    findUserById.mockResolvedValue(baseUser({ id: 'admin-2', storeId: 'store-1', type: 'admin' }));
    const req = {
      body: { firstName: 'Nope' },
      params: { id: 'admin-2' },
      storeId: 'store-1',
      userType: 'admin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(403);
    expect(updateUserByAdmin).not.toHaveBeenCalled();
  });

  it('allows superAdmin to edit deliveryDriver of any store', async () => {
    findUserById.mockResolvedValue(
      baseUser({ id: 'driver-2', storeId: 'store-2', type: 'deliveryDriver' }),
    );
    updateUserByAdmin.mockResolvedValue(
      baseUser({
        firstName: 'Super',
        id: 'driver-2',
        storeId: 'store-2',
        type: 'deliveryDriver',
      }),
    );
    const req = {
      body: { firstName: 'Super' },
      params: { id: 'driver-2' },
      storeId: null,
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminUser(req, res);
    expect(res.statusCode).toBe(200);
    expect(updateUserByAdmin).toHaveBeenCalled();
  });
});
