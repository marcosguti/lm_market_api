import type { UserType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { authHeader, mockAuthenticatedUser } from './helpers/authHelpers.js';
import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { getEnsurePendingCartMock, resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';
import {
  ADMIN_ROLES,
  ALL_ROLES,
  expectAllowed,
  expectForbidden,
  expectUnauthorized,
  NON_CLIENT_ROLES,
} from './helpers/rbacMatrix.js';

const app = createTestApp();

describe('RBAC routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe('GET /api/orders/cart (client only via asClient)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/orders/cart');
    });

    it.each(NON_CLIENT_ROLES)('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'get', '/api/orders/cart', role as UserType);
    });

    it('allows client', async () => {
      mockAuthenticatedUser('u1', 'client');
      const res = await request(app).get('/api/orders/cart').set(authHeader());
      expect(res.status).toBe(200);
      expect(getEnsurePendingCartMock()).toHaveBeenCalledWith('u1', undefined);
    });
  });

  describe('GET /api/admin/orders/kitchen (admin/superAdmin)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/admin/orders/kitchen');
    });

    it.each(['client', 'deliveryDriver'] as UserType[])('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'get', '/api/admin/orders/kitchen', role);
    });

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'get', '/api/admin/orders/kitchen', role, { expectedStatus: 200 });
    });
  });

  describe('GET /api/payments/config (public)', () => {
    it('allows unauthenticated access', async () => {
      const res = await request(app).get('/api/payments/config');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('exposes usdRate from exchange rate service', async () => {
      const res = await request(app).get('/api/payments/config');
      expect(res.status).toBe(200);
      expect(res.body.usdRate).toBe(600);
      expect(res.body).toHaveProperty('usdRateUpdatedAt');
      expect(res.body).toHaveProperty('usdRateSource');
    });
  });
});
