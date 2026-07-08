import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  comparePassword: vi.fn(),
  createHash: vi.fn(),
  createEmailVerificationCode: vi.fn(),
  deleteEmailVerificationCodesByUserId: vi.fn(),
  findLatestEmailVerificationCodeByUserId: vi.fn(),
  incrementEmailVerificationFailedAttempts: vi.fn(),
  prismaUserFindUnique: vi.fn(),
  prismaUserUpdate: vi.fn(),
  sendEmailVerificationCode: vi.fn(),
  sendLoginCode: vi.fn(),
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  comparePassword: mocks.comparePassword,
  createHash: mocks.createHash,
}));

vi.mock('../../../queries/emailVerificationCode.js', () => ({
  createEmailVerificationCode: mocks.createEmailVerificationCode,
  deleteEmailVerificationCodesByUserId: mocks.deleteEmailVerificationCodesByUserId,
  findLatestEmailVerificationCodeByUserId: mocks.findLatestEmailVerificationCodeByUserId,
  incrementEmailVerificationFailedAttempts: mocks.incrementEmailVerificationFailedAttempts,
}));

vi.mock('../../../libs/sendEmail/index.js', () => ({
  sendEmailVerificationCode: mocks.sendEmailVerificationCode,
  sendLoginCode: mocks.sendLoginCode,
}));

vi.mock('../../../prisma.js', () => ({
  default: {
    user: {
      findUnique: mocks.prismaUserFindUnique,
      update: mocks.prismaUserUpdate,
    },
  },
}));

import {
  createAndSendLoginCode,
  createAndSendVerificationCode,
  EmailVerificationError,
  getActiveCodeRemainingSeconds,
  verifyEmailCode,
  verifyLoginCode,
} from '../index.js';

const baseUser = {
  id: 'user-1',
  email: 'test@example.com',
  emailVerified: false,
  firstName: 'Test',
  lastName: 'User',
  numberId: '123',
  numberIdType: 'V' as const,
  password: 'hash',
  phone: null,
  phoneVerified: false,
  address: null,
  type: 'client' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('emailVerification service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createHash.mockResolvedValue('hashed-code');
    mocks.findLatestEmailVerificationCodeByUserId.mockResolvedValue(null);
    mocks.deleteEmailVerificationCodesByUserId.mockResolvedValue(undefined);
    mocks.createEmailVerificationCode.mockResolvedValue({});
    mocks.sendEmailVerificationCode.mockResolvedValue(undefined);
    mocks.sendLoginCode.mockResolvedValue(undefined);
  });

  describe('createAndSendVerificationCode', () => {
    it('sends mailjet email and stores hashed code', async () => {
      const result = await createAndSendVerificationCode(baseUser);

      expect(result.codeExpiresInSeconds).toBeGreaterThan(0);
      expect(mocks.deleteEmailVerificationCodesByUserId).toHaveBeenCalledWith(
        'user-1',
        'email_verification',
      );
      expect(mocks.createEmailVerificationCode).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'email_verification' }),
      );
      expect(mocks.sendEmailVerificationCode).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'Test',
        }),
      );
    });

    it('rejects resend while an active code exists', async () => {
      mocks.findLatestEmailVerificationCodeByUserId.mockResolvedValue({
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 120_000),
        id: 'code-1',
      });

      await expect(createAndSendVerificationCode(baseUser)).rejects.toMatchObject({
        statusCode: 429,
        code: 'CODE_STILL_VALID',
        codeExpiresInSeconds: expect.any(Number),
      });
      expect(mocks.sendEmailVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('createAndSendLoginCode', () => {
    it('sends login code email with login purpose', async () => {
      const verifiedUser = { ...baseUser, emailVerified: true };
      await createAndSendLoginCode(verifiedUser);

      expect(mocks.deleteEmailVerificationCodesByUserId).toHaveBeenCalledWith('user-1', 'login');
      expect(mocks.createEmailVerificationCode).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'login' }),
      );
      expect(mocks.sendLoginCode).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'Test',
        }),
      );
      expect(mocks.sendEmailVerificationCode).not.toHaveBeenCalled();
    });

    it('allows login code while email verification code is still active', async () => {
      mocks.findLatestEmailVerificationCodeByUserId.mockImplementation(
        async (_userId: string, purpose: string) => {
          if (purpose === 'email_verification') {
            return {
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 120_000),
              id: 'verify-code',
            };
          }
          return null;
        },
      );

      const verifiedUser = { ...baseUser, emailVerified: true };
      await createAndSendLoginCode(verifiedUser);

      expect(mocks.sendLoginCode).toHaveBeenCalled();
    });
  });

  describe('getActiveCodeRemainingSeconds', () => {
    it('returns remaining seconds for a valid code', async () => {
      mocks.findLatestEmailVerificationCodeByUserId.mockResolvedValue({
        expiresAt: new Date(Date.now() + 90_000),
      });

      const seconds = await getActiveCodeRemainingSeconds('user-1', 'email_verification');
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(90);
      expect(mocks.findLatestEmailVerificationCodeByUserId).toHaveBeenCalledWith(
        'user-1',
        'email_verification',
      );
    });

    it('returns zero when code expired or missing', async () => {
      mocks.findLatestEmailVerificationCodeByUserId.mockResolvedValue(null);
      expect(await getActiveCodeRemainingSeconds('user-1', 'login')).toBe(0);
    });
  });

  describe('verifyEmailCode', () => {
    it('marks user verified when code matches', async () => {
      mocks.prismaUserFindUnique.mockResolvedValue(baseUser);
      mocks.findLatestEmailVerificationCodeByUserId.mockResolvedValue({
        id: 'code-1',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
        failedAttempts: 0,
      });
      mocks.comparePassword.mockResolvedValue(true);
      mocks.prismaUserUpdate.mockResolvedValue({ ...baseUser, emailVerified: true });

      const user = await verifyEmailCode('test@example.com', '1234');
      expect(user.emailVerified).toBe(true);
      expect(mocks.deleteEmailVerificationCodesByUserId).toHaveBeenCalledWith(
        'user-1',
        'email_verification',
      );
    });

    it('rejects invalid code and increments attempts', async () => {
      mocks.prismaUserFindUnique.mockResolvedValue(baseUser);
      mocks.findLatestEmailVerificationCodeByUserId.mockResolvedValue({
        id: 'code-1',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
        failedAttempts: 0,
      });
      mocks.comparePassword.mockResolvedValue(false);
      mocks.incrementEmailVerificationFailedAttempts.mockResolvedValue({
        failedAttempts: 1,
      });

      await expect(verifyEmailCode('test@example.com', '0000')).rejects.toBeInstanceOf(
        EmailVerificationError,
      );
    });
  });

  describe('verifyLoginCode', () => {
    it('returns verified user without changing emailVerified', async () => {
      const verifiedUser = { ...baseUser, emailVerified: true };
      mocks.prismaUserFindUnique.mockResolvedValue(verifiedUser);
      mocks.findLatestEmailVerificationCodeByUserId.mockResolvedValue({
        id: 'code-1',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
        failedAttempts: 0,
      });
      mocks.comparePassword.mockResolvedValue(true);

      const user = await verifyLoginCode('test@example.com', '1234');
      expect(user.emailVerified).toBe(true);
      expect(mocks.deleteEmailVerificationCodesByUserId).toHaveBeenCalledWith('user-1', 'login');
      expect(mocks.prismaUserUpdate).not.toHaveBeenCalled();
    });

    it('rejects unverified user', async () => {
      mocks.prismaUserFindUnique.mockResolvedValue(baseUser);
      mocks.findLatestEmailVerificationCodeByUserId.mockResolvedValue({
        id: 'code-1',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
        failedAttempts: 0,
      });
      mocks.comparePassword.mockResolvedValue(true);

      await expect(verifyLoginCode('test@example.com', '1234')).rejects.toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
        statusCode: 403,
      });
    });
  });
});
