import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  markUserEmailVerified: vi.fn(),
  deleteEmailVerificationCodesByUserId: vi.fn(),
}));

vi.mock('../../../services/emailVerification/index.js', () => ({
  markUserEmailVerified: mocks.markUserEmailVerified,
  deleteEmailVerificationCodesByUserId: mocks.deleteEmailVerificationCodesByUserId,
}));

import {
  authHeader,
  authMocks,
  mockAuthenticatedUser,
} from '../../../routes/test/helpers/authHelpers.js';
import { createTestApp } from '../../../routes/test/helpers/createTestApp.js';

const app = createTestApp();

const verifiedClient = {
  id: 'u1',
  email: 'client@example.com',
  emailVerified: true,
  firstName: 'Client',
  lastName: 'User',
  numberId: 'V87654321',
  numberIdType: 'V',
  password: 'hash',
  address: null,
  phone: null,
  phoneVerified: false,
  type: 'client' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /api/admin/users/:id/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.findUserById.mockReset();
    authMocks.verifyToken.mockReset();
  });

  it('returns 403 for client', async () => {
    mockAuthenticatedUser('admin-1', 'client');
    const res = await request(app).post('/api/admin/users/u1/verify-email').set(authHeader());
    expect(res.status).toBe(403);
  });

  it('verifies pending user for admin', async () => {
    mockAuthenticatedUser('admin-1', 'admin');
    authMocks.findUserById.mockImplementation((id: string) => {
      if (id === 'admin-1') {
        return Promise.resolve({
          id: 'admin-1',
          type: 'admin',
          email: 'admin@test.com',
          emailVerified: true,
          firstName: 'Admin',
          lastName: 'User',
          numberId: 'V12345678',
          numberIdType: 'V',
          password: 'hash',
          address: null,
          phone: null,
          phoneVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return Promise.resolve({
        id: 'u1',
        emailVerified: false,
      });
    });
    mocks.markUserEmailVerified.mockResolvedValue({
      ...verifiedClient,
      emailVerified: true,
    });

    const res = await request(app).post('/api/admin/users/u1/verify-email').set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
    expect(mocks.deleteEmailVerificationCodesByUserId).toHaveBeenCalledWith('u1');
  });

  it('returns 400 if already verified', async () => {
    mockAuthenticatedUser('admin-1', 'admin');
    authMocks.findUserById.mockImplementation((id: string) => {
      if (id === 'u1') {
        return Promise.resolve(verifiedClient);
      }
      return Promise.resolve({
        id: 'admin-1',
        type: 'admin',
        email: 'admin@test.com',
        emailVerified: true,
        firstName: 'Admin',
        lastName: 'User',
        numberId: 'V12345678',
        numberIdType: 'V',
        password: 'hash',
        address: null,
        phone: null,
        phoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const res = await request(app).post('/api/admin/users/u1/verify-email').set(authHeader());

    expect(res.status).toBe(400);
    expect(mocks.markUserEmailVerified).not.toHaveBeenCalled();
  });
});
