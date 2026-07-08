import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  comparePassword: vi.fn(),
  createHash: vi.fn(),
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  findUserByNumberId: vi.fn(),
  findUserByPhone: vi.fn(),
  createAndSendVerificationCode: vi.fn(),
  getActiveCodeRemainingSeconds: vi.fn(),
  verifyEmailCode: vi.fn(),
  markUserEmailVerified: vi.fn(),
  deleteEmailVerificationCodesByUserId: vi.fn(),
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  comparePassword: authMocks.comparePassword,
  createHash: authMocks.createHash,
}));

vi.mock('../../../queries/user.js', () => ({
  createUser: authMocks.createUser,
  findUserByEmail: authMocks.findUserByEmail,
  findUserById: authMocks.findUserById,
  findUserByNumberId: authMocks.findUserByNumberId,
  findUserByPhone: authMocks.findUserByPhone,
}));

vi.mock('../../../services/emailVerification/index.js', () => ({
  createAndSendVerificationCode: authMocks.createAndSendVerificationCode,
  getActiveCodeRemainingSeconds: authMocks.getActiveCodeRemainingSeconds,
  verifyEmailCode: authMocks.verifyEmailCode,
  markUserEmailVerified: authMocks.markUserEmailVerified,
  deleteEmailVerificationCodesByUserId: authMocks.deleteEmailVerificationCodesByUserId,
  EmailVerificationError: class EmailVerificationError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public code?: string,
    ) {
      super(message);
    }
  },
}));

vi.mock('../../../libs/jwt.js', () => ({
  signAccessToken: vi.fn(() => 'access'),
  signRefreshToken: vi.fn(() => 'refresh'),
}));

vi.mock('../../../queries/linkedDevice.js', () => ({
  upsertLinkedDevice: vi.fn(),
}));

vi.mock('../../../queries/token.js', () => ({
  createToken: vi.fn(),
}));

import { createTestApp } from '../../../routes/test/helpers/createTestApp.js';

const app = createTestApp();

const unverifiedUser = {
  id: 'u1',
  email: 'client@example.com',
  emailVerified: false,
  password: 'hash',
  firstName: 'Client',
  lastName: 'Test',
};

describe('email verification auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.findUserByNumberId.mockResolvedValue(null);
    authMocks.findUserByPhone.mockResolvedValue(null);
    authMocks.createHash.mockResolvedValue('hashed');
  });

  it('register sends verification code and returns TTL', async () => {
    authMocks.findUserByEmail.mockResolvedValue(null);
    authMocks.createUser.mockResolvedValue(unverifiedUser);
    authMocks.createAndSendVerificationCode.mockResolvedValue({
      codeExpiresAt: new Date(Date.now() + 1_800_000).toISOString(),
      codeExpiresInSeconds: 1800,
    });

    const res = await request(app).post('/api/auth/register').send({
      email: 'client@example.com',
      password: 'Password1',
      firstName: 'Client',
      lastName: 'Test',
      numberId: '12345678',
      numberIdType: 'V',
    });

    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.codeSent).toBe(true);
    expect(res.body.codeExpiresInSeconds).toBe(1800);
    expect(res.body.accessToken).toBeUndefined();
    expect(authMocks.createAndSendVerificationCode).toHaveBeenCalled();
  });

  it('login blocks unverified user and returns remaining TTL', async () => {
    authMocks.findUserByEmail.mockResolvedValue(unverifiedUser);
    authMocks.comparePassword.mockResolvedValue(true);
    authMocks.getActiveCodeRemainingSeconds.mockResolvedValue(900);

    const res = await request(app).post('/api/auth/login').send({
      deviceId: 'dev-1',
      email: 'client@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body.codeExpiresInSeconds).toBe(900);
    expect(authMocks.createAndSendVerificationCode).not.toHaveBeenCalled();
  });

  it('verify-email/send triggers mailjet service and returns TTL', async () => {
    authMocks.findUserByEmail.mockResolvedValue(unverifiedUser);
    authMocks.createAndSendVerificationCode.mockResolvedValue({
      codeExpiresAt: new Date(Date.now() + 1_800_000).toISOString(),
      codeExpiresInSeconds: 1800,
    });

    const res = await request(app).post('/api/auth/verify-email/send').send({
      email: 'client@example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body.codeExpiresInSeconds).toBe(1800);
    expect(authMocks.createAndSendVerificationCode).toHaveBeenCalled();
  });

  it('verify-email returns tokens on success', async () => {
    authMocks.verifyEmailCode.mockResolvedValue({ ...unverifiedUser, emailVerified: true });

    const res = await request(app).post('/api/auth/verify-email').send({
      code: '1234',
      deviceId: 'dev-1',
      email: 'client@example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('access');
    expect(res.body.refreshToken).toBe('refresh');
  });
});
