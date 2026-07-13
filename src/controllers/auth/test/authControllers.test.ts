import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';

const findUserByEmail = vi.fn();
const findUserByNumberId = vi.fn();
const findUserByPhone = vi.fn();
const createUser = vi.fn();
const createAndSendVerificationCode = vi.fn();

vi.mock('../../../queries/user.js', () => ({
  createUser: (...args: unknown[]) => createUser(...args),
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
  findUserByNumberId: (...args: unknown[]) => findUserByNumberId(...args),
  findUserByPhone: (...args: unknown[]) => findUserByPhone(...args),
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  comparePassword: vi.fn(),
  createHash: vi.fn().mockResolvedValue('hashed'),
}));

vi.mock('../../../services/emailVerification/index.js', () => ({
  EmailVerificationError: class EmailVerificationError extends Error {
    code = 'RATE_LIMIT';
    statusCode = 429;
    codeExpiresInSeconds = 60;
    constructor(message: string) {
      super(message);
    }
  },
  createAndSendVerificationCode: (...args: unknown[]) => createAndSendVerificationCode(...args),
  getActiveCodeRemainingSeconds: vi.fn().mockResolvedValue(120),
}));

import { comparePassword } from '../../../libs/passwordHashing.js';

import { register } from '../register.js';
import { login } from '../login.js';
import { sendVerificationCode } from '../sendVerificationCode.js';

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

const validRegisterBody = {
  email: 'new@test.com',
  password: 'Secret123!',
  firstName: 'New',
  lastName: 'User',
  numberId: 'V12345678',
  numberIdType: 'V',
  type: 'client',
};

describe('auth controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUserByEmail.mockResolvedValue(null);
    findUserByNumberId.mockResolvedValue(null);
    findUserByPhone.mockResolvedValue(null);
    createUser.mockResolvedValue({
      id: 'u-new',
      email: 'new@test.com',
      firstName: 'New',
    });
    createAndSendVerificationCode.mockResolvedValue({ codeExpiresInSeconds: 600 });
  });

  describe('register', () => {
    it('returns 409 when email already exists', async () => {
      findUserByEmail.mockResolvedValue({ id: 'existing' });
      const req = { body: validRegisterBody } as AuthRequest;
      const res = mockRes();
      await register(req, res);
      expect(res.statusCode).toBe(409);
    });

    it('returns 409 when numberId already exists', async () => {
      findUserByNumberId.mockResolvedValue({ id: 'existing' });
      const req = { body: validRegisterBody } as AuthRequest;
      const res = mockRes();
      await register(req, res);
      expect(res.statusCode).toBe(409);
    });

    it('creates user and sends verification on success', async () => {
      const req = { body: validRegisterBody } as AuthRequest;
      const res = mockRes();
      await register(req, res);
      expect(res.statusCode).toBe(201);
      expect(createUser).toHaveBeenCalled();
      expect(createAndSendVerificationCode).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns 401 for invalid credentials', async () => {
      findUserByEmail.mockResolvedValue(null);
      const req = { body: { email: 'x@test.com', password: 'wrong', deviceId: 'd1' } } as never;
      const res = mockRes();
      await login(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when email is not verified', async () => {
      findUserByEmail.mockResolvedValue({
        id: 'u1',
        email: 'x@test.com',
        password: 'hash',
        emailVerified: false,
      });
      vi.mocked(comparePassword).mockResolvedValue(true);
      const req = {
        body: { email: 'x@test.com', password: 'Secret123!', deviceId: 'd1' },
      } as never;
      const res = mockRes();
      await login(req, res);
      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    });
  });

  describe('sendVerificationCode', () => {
    it('returns generic message when user not found', async () => {
      findUserByEmail.mockResolvedValue(null);
      const req = { body: { email: 'unknown@test.com' } } as never;
      const res = mockRes();
      await sendVerificationCode(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ message: expect.stringMatching(/Si el correo/i) });
    });

    it('returns generic message when email already verified', async () => {
      findUserByEmail.mockResolvedValue({ id: 'u1', emailVerified: true });
      const req = { body: { email: 'verified@test.com' } } as never;
      const res = mockRes();
      await sendVerificationCode(req, res);
      expect(createAndSendVerificationCode).not.toHaveBeenCalled();
    });

    it('sends code for unverified user', async () => {
      findUserByEmail.mockResolvedValue({ id: 'u1', emailVerified: false, firstName: 'A' });
      const req = { body: { email: 'pending@test.com' } } as never;
      const res = mockRes();
      await sendVerificationCode(req, res);
      expect(createAndSendVerificationCode).toHaveBeenCalled();
      expect(res.body).toMatchObject({ message: 'Código enviado a tu correo' });
    });
  });
});
