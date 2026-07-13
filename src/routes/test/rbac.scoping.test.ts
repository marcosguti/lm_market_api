import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authHeader, mockAuthenticatedUser } from './helpers/authHelpers.js';
import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { getUserQueryMocks } from './helpers/queryMocks.js';
import { resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { getOrderMocks, resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';

const app = createTestApp();
const ORDER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '33333333-3333-3333-3333-333333333333';

describe('RBAC scoping rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe('GET /api/admin/users actor scoping', () => {
    it('passes admin actorType to listUsersPaginated', async () => {
      mockAuthenticatedUser('admin-1', 'admin');
      await request(app).get('/api/admin/users').set(authHeader());
      expect(getUserQueryMocks().listUsersPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ actorType: 'admin' }),
      );
    });

    it('passes superAdmin actorType to listUsersPaginated', async () => {
      mockAuthenticatedUser('super-1', 'superAdmin');
      await request(app).get('/api/admin/users').set(authHeader());
      expect(getUserQueryMocks().listUsersPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ actorType: 'superAdmin' }),
      );
    });
  });

  describe('DELETE /api/admin/users/:id self-delete', () => {
    it('returns 403 when admin deletes own account', async () => {
      mockAuthenticatedUser('admin-1', 'admin');
      const res = await request(app).delete('/api/admin/users/admin-1').set(authHeader());
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('No puedes eliminar tu propia cuenta');
      expect(getUserQueryMocks().deleteUserById).not.toHaveBeenCalled();
    });

    it('allows admin to delete another user', async () => {
      mockAuthenticatedUser('admin-1', 'admin');
      const res = await request(app).delete(`/api/admin/users/${OTHER_USER_ID}`).set(authHeader());
      expect(res.status).toBe(200);
      expect(getUserQueryMocks().deleteUserById).toHaveBeenCalledWith(OTHER_USER_ID);
    });
  });

  describe('PATCH /api/delivery/orders/:id/delivered ownership', () => {
    it('calls markOrderDelivered with deliveryDriver actor', async () => {
      mockAuthenticatedUser('driver-1', 'deliveryDriver');
      await request(app).patch(`/api/delivery/orders/${ORDER_ID}/delivered`).set(authHeader());
      expect(getOrderMocks().markOrderDelivered).toHaveBeenCalledWith(
        'deliveryDriver',
        ORDER_ID,
        'driver-1',
      );
    });

    it('calls markOrderDelivered with admin actor', async () => {
      mockAuthenticatedUser('admin-1', 'admin');
      await request(app).patch(`/api/delivery/orders/${ORDER_ID}/delivered`).set(authHeader());
      expect(getOrderMocks().markOrderDelivered).toHaveBeenCalledWith('admin', ORDER_ID, 'admin-1');
    });
  });
});
