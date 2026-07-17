import type { UserType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';
import {
  ADMIN_ROLES,
  ALL_ROLES,
  expectAllowed,
  expectForbidden,
  expectUnauthorized,
} from './helpers/rbacMatrix.js';

const app = createTestApp();
const ORDER_ID = '11111111-1111-1111-1111-111111111111';

describe('RBAC delivery and admin order routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe('GET /api/delivery/orders/mine (deliveryDriver)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/delivery/orders/mine');
    });

    it.each(['client', 'admin', 'superAdmin'] as UserType[])('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'get', '/api/delivery/orders/mine', role);
    });

    it('allows deliveryDriver', async () => {
      await expectAllowed(app, 'get', '/api/delivery/orders/mine', 'deliveryDriver', {
        expectedStatus: 200,
      });
    });
  });

  describe('PATCH /api/delivery/orders/:id/start', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/delivery/orders/:id/start', {
        pathParams: { id: ORDER_ID },
      });
    });

    it('returns 403 for client', async () => {
      await expectForbidden(app, 'patch', '/api/delivery/orders/:id/start', 'client', {
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(['admin', 'superAdmin', 'deliveryDriver'] as UserType[])('allows %s', async (role) => {
      await expectAllowed(app, 'patch', '/api/delivery/orders/:id/start', role, {
        expectedStatus: 200,
        pathParams: { id: ORDER_ID },
      });
    });
  });

  describe('PATCH /api/delivery/orders/:id/delivered', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/delivery/orders/:id/delivered', {
        pathParams: { id: ORDER_ID },
      });
    });

    it('returns 403 for client', async () => {
      await expectForbidden(app, 'patch', '/api/delivery/orders/:id/delivered', 'client', {
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(['admin', 'superAdmin', 'deliveryDriver'] as UserType[])('allows %s', async (role) => {
      const { mockAuthenticatedUser, authHeader } = await import('./helpers/authHelpers.js');
      const request = (await import('supertest')).default;
      mockAuthenticatedUser('u1', role);
      const res = await request(app)
        .patch(`/api/delivery/orders/${ORDER_ID}/delivered`)
        .set(authHeader())
        .attach('deliveryProof', Buffer.from('fake-image'), {
          filename: 'proof.jpg',
          contentType: 'image/jpeg',
        });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/admin/orders/:id/assign-delivery (admin/superAdmin)', () => {
    const body = { deliveryUserId: '22222222-2222-2222-2222-222222222222' };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'post', '/api/admin/orders/:id/assign-delivery', {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(['client', 'deliveryDriver'] as UserType[])('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'post', '/api/admin/orders/:id/assign-delivery', role, {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'post', '/api/admin/orders/:id/assign-delivery', role, {
        body,
        expectedStatus: 200,
        pathParams: { id: ORDER_ID },
      });
    });
  });

  describe('GET /api/admin/orders/:id/status-history (admin/superAdmin)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/admin/orders/:id/status-history', {
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(['client', 'deliveryDriver'] as UserType[])('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'get', '/api/admin/orders/:id/status-history', role, {
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'get', '/api/admin/orders/:id/status-history', role, {
        expectedStatus: 200,
        pathParams: { id: ORDER_ID },
      });
    });
  });

  describe('PATCH /api/admin/orders/:id/status (admin/superAdmin)', () => {
    const body = { status: 'preparing' };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/admin/orders/:id/status', {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(['client', 'deliveryDriver'] as UserType[])('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'patch', '/api/admin/orders/:id/status', role, {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'patch', '/api/admin/orders/:id/status', role, {
        body,
        expectedStatus: 200,
        pathParams: { id: ORDER_ID },
      });
    });
  });

  describe('PATCH /api/admin/orders/:id/verify-payment (admin/superAdmin)', () => {
    const body = { verify: true };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/admin/orders/:id/verify-payment', {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(['client', 'deliveryDriver'] as UserType[])('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'patch', '/api/admin/orders/:id/verify-payment', role, {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'patch', '/api/admin/orders/:id/verify-payment', role, {
        body,
        expectedStatus: 200,
        pathParams: { id: ORDER_ID },
      });
    });
  });

  describe('GET /api/admin/users (admin/superAdmin)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/admin/users');
    });

    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        await expectForbidden(app, 'get', '/api/admin/users', role as UserType);
      },
    );

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'get', '/api/admin/users', role, { expectedStatus: 200 });
    });
  });
});
