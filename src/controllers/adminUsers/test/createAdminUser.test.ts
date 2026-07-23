import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { createAdminUser } from '../createAdminUser.js';

const findUserByEmail = vi.fn();
const findUserByNumberId = vi.fn();
const findUserByPhone = vi.fn();
const createUser = vi.fn();
const assertStoreActive = vi.fn();
const createHash = vi.fn();
const generateStrongPassword = vi.fn();
const sendAdminAccountCreatedEmail = vi.fn();

vi.mock('../../../queries/user.js', () => ({
  createUser: (...args: unknown[]) => createUser(...args),
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
  findUserByNumberId: (...args: unknown[]) => findUserByNumberId(...args),
  findUserByPhone: (...args: unknown[]) => findUserByPhone(...args),
}));

vi.mock('../../../queries/store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../queries/store.js')>();
  return {
    ...actual,
    assertStoreActive: (...args: unknown[]) => assertStoreActive(...args),
  };
});

vi.mock('../../../libs/passwordHashing.js', () => ({
  createHash: (...args: unknown[]) => createHash(...args),
}));

vi.mock('../../../libs/generateStrongPassword.js', () => ({
  generateStrongPassword: (...args: unknown[]) => generateStrongPassword(...args),
}));

vi.mock('../../../libs/sendEmail/index.js', () => ({
  sendAdminAccountCreatedEmail: (...args: unknown[]) => sendAdminAccountCreatedEmail(...args),
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

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'new@test.com',
    numberId: '123',
    phone: null,
    type: 'client',
    storeId: null,
    firstName: 'New',
    lastName: 'User',
    numberIdType: 'V',
    password: 'hash',
    address: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
    phoneVerified: false,
    ...overrides,
  };
}

describe('createAdminUser controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUserByEmail.mockResolvedValue(null);
    findUserByNumberId.mockResolvedValue(null);
    findUserByPhone.mockResolvedValue(null);
    assertStoreActive.mockResolvedValue(undefined);
    createHash.mockResolvedValue('hashed');
    generateStrongPassword.mockReturnValue('TempPass1abc');
    sendAdminAccountCreatedEmail.mockResolvedValue(undefined);
    createUser.mockResolvedValue(baseUser());
    vi.stubEnv('WEB_BASE_URL', 'https://www.lmmarket.com');
  });

  it('returns 400 when password is provided', async () => {
    const req = {
      body: {
        email: 'new@test.com',
        firstName: 'New',
        lastName: 'User',
        numberId: '123',
        numberIdType: 'V',
        password: 'TempPass1',
        type: 'client',
      },
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await createAdminUser(req, res);
    expect(res.statusCode).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('generates password, creates user, sends email and does not return password', async () => {
    const req = {
      body: {
        email: 'new@test.com',
        firstName: 'New',
        lastName: 'User',
        numberId: '123',
        numberIdType: 'V',
        type: 'client',
      },
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await createAdminUser(req, res);

    expect(res.statusCode).toBe(201);
    expect(generateStrongPassword).toHaveBeenCalled();
    expect(createHash).toHaveBeenCalledWith('TempPass1abc');
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@test.com',
        password: 'hashed',
        type: 'client',
      }),
    );
    expect(sendAdminAccountCreatedEmail).toHaveBeenCalledWith({
      email: 'new@test.com',
      firstName: 'New',
      recoverPasswordUrl: 'https://www.lmmarket.com/recuperar-contrasena',
      roleLabel: 'Cliente',
      temporaryPassword: 'TempPass1abc',
    });
    expect(res.body).toEqual({
      user: expect.objectContaining({ email: 'new@test.com' }),
    });
    expect(res.body).not.toHaveProperty('temporaryPassword');
  });

  it('still returns 201 when email send fails', async () => {
    sendAdminAccountCreatedEmail.mockRejectedValue(new Error('mail down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = {
      body: {
        email: 'new@test.com',
        firstName: 'New',
        lastName: 'User',
        numberId: '123',
        numberIdType: 'V',
        type: 'client',
      },
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await createAdminUser(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      user: expect.objectContaining({ email: 'new@test.com' }),
    });
    expect(res.body).not.toHaveProperty('temporaryPassword');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
