import type { UserType } from '@prisma/client';
import { beforeEach, describe, it, vi } from 'vitest';

import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';
import { ALL_ROLES, expectAllowed, expectUnauthorized } from './helpers/rbacMatrix.js';

const app = createTestApp();
const NOTIFICATION_ID = '22222222-2222-2222-2222-222222222222';

describe('RBAC auth and notifications routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe('GET /api/auth/me (any authenticated)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/auth/me');
    });

    it.each(ALL_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'get', '/api/auth/me', role as UserType, { expectedStatus: 200 });
    });
  });

  describe('PATCH /api/auth/cuenta (any authenticated)', () => {
    const body = { firstName: 'Updated' };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/auth/cuenta', { body });
    });

    it.each(ALL_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'patch', '/api/auth/cuenta', role as UserType, {
        body,
        expectedStatus: 200,
      });
    });
  });

  describe('POST /api/auth/cambiar-password (any authenticated)', () => {
    const body = { currentPassword: 'OldPass1a', newPassword: 'NewPass1b' };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'post', '/api/auth/cambiar-password', { body });
    });

    it.each(ALL_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'post', '/api/auth/cambiar-password', role as UserType, {
        body,
        expectedStatus: 200,
      });
    });
  });

  describe('POST /api/auth/logout (any authenticated)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'post', '/api/auth/logout');
    });

    it.each(ALL_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'post', '/api/auth/logout', role as UserType, {
        expectedStatus: 200,
      });
    });
  });

  describe('GET /api/notifications (any authenticated)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/notifications');
    });

    it.each(ALL_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'get', '/api/notifications', role as UserType, {
        expectedStatus: 200,
      });
    });
  });

  describe('PATCH /api/notifications/:id/read (any authenticated)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/notifications/:id/read', {
        pathParams: { id: NOTIFICATION_ID },
      });
    });

    it.each(ALL_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'patch', '/api/notifications/:id/read', role as UserType, {
        expectedStatus: 200,
        pathParams: { id: NOTIFICATION_ID },
      });
    });
  });

  describe('POST /api/notifications/read-all (any authenticated)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'post', '/api/notifications/read-all');
    });

    it.each(ALL_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'post', '/api/notifications/read-all', role as UserType, {
        expectedStatus: 200,
      });
    });
  });
});
