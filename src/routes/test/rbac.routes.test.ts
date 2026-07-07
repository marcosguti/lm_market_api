import type { UserType } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authHeader, mockAuthenticatedUser } from './helpers/authHelpers.js';
import './helpers/orderServiceMocks.js';
import { getEnsurePendingCartMock, resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';

const app = createTestApp();
const ALL_ROLES: UserType[] = ['client', 'admin', 'superAdmin', 'deliveryDriver'];

describe('RBAC routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
  });

  describe('GET /api/orders/cart (client only via asClient)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/orders/cart');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No autorizado');
    });

    it.each(['admin', 'superAdmin', 'deliveryDriver'] as UserType[])(
      'returns 403 for %s',
      async (role) => {
        mockAuthenticatedUser('u1', role);
        const res = await request(app).get('/api/orders/cart').set(authHeader());
        expect(res.status).toBe(403);
      },
    );

    it('allows client', async () => {
      mockAuthenticatedUser('u1', 'client');
      const res = await request(app).get('/api/orders/cart').set(authHeader());
      expect(res.status).toBe(200);
      expect(getEnsurePendingCartMock()).toHaveBeenCalledWith('u1', undefined);
    });
  });

  describe('GET /api/admin/orders/kitchen (admin/superAdmin)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/admin/orders/kitchen');
      expect(res.status).toBe(401);
    });

    it.each(['client', 'deliveryDriver'] as UserType[])('returns 403 for %s', async (role) => {
      mockAuthenticatedUser('u1', role);
      const res = await request(app).get('/api/admin/orders/kitchen').set(authHeader());
      expect(res.status).toBe(403);
    });

    it.each(['admin', 'superAdmin'] as UserType[])('allows %s', async (role) => {
      mockAuthenticatedUser('u1', role);
      const res = await request(app).get('/api/admin/orders/kitchen').set(authHeader());
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/users (admin/superAdmin)', () => {
    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        mockAuthenticatedUser('u1', role as UserType);
        const res = await request(app).get('/api/admin/users').set(authHeader());
        expect(res.status).toBe(403);
      },
    );
  });

  describe('GET /api/delivery/orders/available (deliveryDriver)', () => {
    it('returns 403 for client', async () => {
      mockAuthenticatedUser('u1', 'client');
      const res = await request(app).get('/api/delivery/orders/available').set(authHeader());
      expect(res.status).toBe(403);
    });

    it('allows deliveryDriver', async () => {
      mockAuthenticatedUser('u1', 'deliveryDriver');
      const res = await request(app).get('/api/delivery/orders/available').set(authHeader());
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/payments/config (public)', () => {
    it('allows unauthenticated access', async () => {
      const res = await request(app).get('/api/payments/config');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
