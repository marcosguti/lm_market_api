import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  createAndSendLoginCode: vi.fn(),
  findUserByEmail: vi.fn(),
  verifyLoginCode: vi.fn(),
}));

vi.mock('../../../queries/user.js', () => ({
  findUserByEmail: authMocks.findUserByEmail,
}));

vi.mock('../../../services/emailVerification/index.js', () => ({
  createAndSendLoginCode: authMocks.createAndSendLoginCode,
  verifyLoginCode: authMocks.verifyLoginCode,
  EmailVerificationError: class EmailVerificationError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public code?: string,
      public codeExpiresInSeconds?: number,
    ) {
      super(message);
    }
  },
}));

vi.mock('../../../libs/jwt.js', () => ({
  signAccessToken: vi.fn(() => 'access'),
  signRefreshToken: vi.fn(() => 'refresh'),
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  createHash: vi.fn().mockResolvedValue('hashed'),
}));

vi.mock('../../../queries/linkedDevice.js', () => ({
  upsertLinkedDevice: vi.fn(),
}));

vi.mock('../../../queries/token.js', () => ({
  createToken: vi.fn(),
}));

import { createTestApp } from '../../../routes/test/helpers/createTestApp.js';

const app = createTestApp();

const verifiedUser = {
  id: 'u1',
  email: 'client@example.com',
  emailVerified: true,
  password: 'hash',
  firstName: 'Client',
  lastName: 'Test',
};

describe('login-code auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('send rejects unregistered email', async () => {
    authMocks.findUserByEmail.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/login-code/send').send({
      email: 'missing@example.com',
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('EMAIL_NOT_REGISTERED');
  });

  it('send rejects unverified email', async () => {
    authMocks.findUserByEmail.mockResolvedValue({
      ...verifiedUser,
      emailVerified: false,
    });

    const res = await request(app).post('/api/auth/login-code/send').send({
      email: 'client@example.com',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('send returns TTL on success', async () => {
    authMocks.findUserByEmail.mockResolvedValue(verifiedUser);
    authMocks.createAndSendLoginCode.mockResolvedValue({
      codeExpiresAt: new Date(Date.now() + 1_800_000).toISOString(),
      codeExpiresInSeconds: 1800,
    });

    const res = await request(app).post('/api/auth/login-code/send').send({
      email: 'client@example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body.codeExpiresInSeconds).toBe(1800);
    expect(authMocks.createAndSendLoginCode).toHaveBeenCalledWith(verifiedUser);
  });

  it('send returns CODE_STILL_VALID when code is active', async () => {
    authMocks.findUserByEmail.mockResolvedValue(verifiedUser);
    const { EmailVerificationError } = await import('../../../services/emailVerification/index.js');
    authMocks.createAndSendLoginCode.mockRejectedValue(
      new EmailVerificationError('Ya tienes un código vigente', 429, 'CODE_STILL_VALID', 600),
    );

    const res = await request(app).post('/api/auth/login-code/send').send({
      email: 'client@example.com',
    });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('CODE_STILL_VALID');
    expect(res.body.codeExpiresInSeconds).toBe(600);
  });

  it('verify returns tokens on success', async () => {
    authMocks.verifyLoginCode.mockResolvedValue(verifiedUser);

    const res = await request(app).post('/api/auth/login-code/verify').send({
      code: '1234',
      deviceId: 'dev-1',
      email: 'client@example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('access');
    expect(res.body.refreshToken).toBe('refresh');
    expect(res.body.user.email).toBe('client@example.com');
  });

  it('verify rejects invalid code', async () => {
    const { EmailVerificationError } = await import('../../../services/emailVerification/index.js');
    authMocks.verifyLoginCode.mockRejectedValue(
      new EmailVerificationError('Código incorrecto', 400, 'INVALID_CODE'),
    );

    const res = await request(app).post('/api/auth/login-code/verify').send({
      code: '0000',
      deviceId: 'dev-1',
      email: 'client@example.com',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CODE');
  });
});
