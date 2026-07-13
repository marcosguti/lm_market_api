import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const findUserByEmail = vi.fn();
const createPasswordResetToken = vi.fn();
const deletePasswordResetTokensByUserId = vi.fn();
const findPasswordResetTokenByToken = vi.fn();
const deletePasswordResetToken = vi.fn();
const sendPasswordResetEmail = vi.fn();

vi.mock('../../../queries/user.js', () => ({
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
}));

vi.mock('../../../queries/passwordResetToken.js', () => ({
  createPasswordResetToken: (...args: unknown[]) => createPasswordResetToken(...args),
  deletePasswordResetToken: (...args: unknown[]) => deletePasswordResetToken(...args),
  deletePasswordResetTokensByUserId: (...args: unknown[]) =>
    deletePasswordResetTokensByUserId(...args),
  findPasswordResetTokenByToken: (...args: unknown[]) => findPasswordResetTokenByToken(...args),
}));

vi.mock('../../../libs/sendEmail/index.js', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  comparePassword: vi.fn(),
  createHash: vi.fn().mockResolvedValue('new-hash'),
}));

import { createTestApp } from '../../../routes/test/helpers/createTestApp.js';
import '../../../routes/test/helpers/sharedMocks.js';

const app = createTestApp();

describe('Password reset HTTP flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  describe('POST /api/auth/recover-password/request', () => {
    it('returns generic message when email is unknown', async () => {
      findUserByEmail.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/auth/recover-password/request')
        .send({ email: 'unknown@test.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Si el email existe/i);
      expect(createPasswordResetToken).not.toHaveBeenCalled();
    });

    it('creates token and sends email for existing user', async () => {
      findUserByEmail.mockResolvedValue({
        id: 'u1',
        email: 'client@test.com',
        firstName: 'Client',
      });
      const res = await request(app)
        .post('/api/auth/recover-password/request')
        .send({ email: 'client@test.com' });
      expect(res.status).toBe(200);
      expect(deletePasswordResetTokensByUserId).toHaveBeenCalledWith('u1');
      expect(createPasswordResetToken).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/recover-password/request')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/recover-password/validate', () => {
    it('returns valid true for active token', async () => {
      findPasswordResetTokenByToken.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        token: 'tok',
        userId: 'u1',
      });
      const res = await request(app)
        .get('/api/auth/recover-password/validate')
        .query({ token: 'tok' });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it('returns 400 when token is expired', async () => {
      findPasswordResetTokenByToken.mockResolvedValue({
        expiresAt: new Date(Date.now() - 1000),
        token: 'old',
        userId: 'u1',
      });
      const res = await request(app)
        .get('/api/auth/recover-password/validate')
        .query({ token: 'old' });
      expect(res.status).toBe(400);
      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe('expired');
    });
  });
});
