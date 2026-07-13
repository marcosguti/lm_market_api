import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const findUserByEmail = vi.fn();
const findUserByNumberId = vi.fn();
const createUser = vi.fn();
const createAndSendVerificationCode = vi.fn();
const findLinkedDeviceByUserIdAndDeviceId = vi.fn();
const comparePassword = vi.fn();
const findUserById = vi.fn();
const issueAuthSession = vi.fn();

vi.mock('../../queries/user.js', () => ({
  createUser: (...args: unknown[]) => createUser(...args),
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
  findUserById: (...args: unknown[]) => findUserById(...args),
  findUserByNumberId: (...args: unknown[]) => findUserByNumberId(...args),
}));

vi.mock('../../queries/linkedDevice.js', () => ({
  findLinkedDeviceByUserIdAndDeviceId: (...args: unknown[]) =>
    findLinkedDeviceByUserIdAndDeviceId(...args),
  revokeLinkedDevice: vi.fn(),
  updateLinkedDeviceRefreshTokenHash: vi.fn(),
  upsertLinkedDevice: vi.fn(),
}));

vi.mock('../../libs/passwordHashing.js', () => ({
  comparePassword: (...args: unknown[]) => comparePassword(...args),
  createHash: vi.fn().mockResolvedValue('hashed'),
}));

vi.mock('../../libs/jwt.js', () => ({
  signAccessToken: vi.fn(() => 'access'),
  signRefreshToken: vi.fn(() => 'refresh'),
  verifyToken: vi.fn(() => ({ userId: 'u1' })),
}));

vi.mock('../../services/emailVerification/index.js', () => ({
  createAndSendVerificationCode: (...args: unknown[]) => createAndSendVerificationCode(...args),
  getActiveCodeRemainingSeconds: vi.fn().mockResolvedValue(60),
}));

vi.mock('../../controllers/auth/issueAuthSession.js', () => ({
  issueAuthSession: (...args: unknown[]) => issueAuthSession(...args),
}));

import { createTestApp } from './helpers/createTestApp.js';
import './helpers/sharedMocks.js';

const app = createTestApp();

describe('Auth business routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUserByEmail.mockResolvedValue(null);
    findUserByNumberId.mockResolvedValue(null);
    createUser.mockResolvedValue({
      id: 'u-new',
      email: 'new@test.com',
      firstName: 'New',
    });
    createAndSendVerificationCode.mockResolvedValue({ codeExpiresInSeconds: 600 });
    issueAuthSession.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
  });

  describe('POST /api/auth/register', () => {
    it('returns 201 on successful registration', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'new@test.com',
        password: 'Secret123!',
        firstName: 'New',
        lastName: 'User',
        numberId: 'V12345678',
        numberIdType: 'V',
        type: 'client',
      });
      expect(res.status).toBe(201);
      expect(res.body.requiresVerification).toBe(true);
    });

    it('returns 409 for duplicate email', async () => {
      findUserByEmail.mockResolvedValue({ id: 'existing' });
      const res = await request(app).post('/api/auth/register').send({
        email: 'dup@test.com',
        password: 'Secret123!',
        firstName: 'New',
        lastName: 'User',
        numberId: 'V12345678',
        numberIdType: 'V',
        type: 'client',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 401 for unknown user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'unknown@test.com',
        password: 'Secret123!',
        deviceId: 'device-1',
      });
      expect(res.status).toBe(401);
    });

    it('returns session for verified user', async () => {
      findUserByEmail.mockResolvedValue({
        id: 'u1',
        email: 'client@test.com',
        password: 'hash',
        emailVerified: true,
      });
      comparePassword.mockResolvedValue(true);
      const res = await request(app).post('/api/auth/login').send({
        email: 'client@test.com',
        password: 'Secret123!',
        deviceId: 'device-1',
      });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe('access');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns 401 when linked device is missing', async () => {
      findLinkedDeviceByUserIdAndDeviceId.mockResolvedValue(null);
      const res = await request(app).post('/api/auth/refresh').send({
        deviceId: 'device-1',
        refreshToken: 'token',
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 when email is not verified', async () => {
      findLinkedDeviceByUserIdAndDeviceId.mockResolvedValue({
        refreshTokenHash: 'hash',
      });
      comparePassword.mockResolvedValue(true);
      findUserById.mockResolvedValue({ id: 'u1', emailVerified: false });
      const res = await request(app).post('/api/auth/refresh').send({
        deviceId: 'device-1',
        refreshToken: 'token',
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });
});
