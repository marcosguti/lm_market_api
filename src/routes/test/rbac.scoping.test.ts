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
    it('passes admin actorType and actorStoreId to listUsersPaginated', async () => {
      mockAuthenticatedUser('admin-1', 'admin');
      await request(app).get('/api/admin/users').set(authHeader());
      expect(getUserQueryMocks().listUsersPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ actorStoreId: 'store-1', actorType: 'admin' }),
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
      await request(app)
        .patch(`/api/delivery/orders/${ORDER_ID}/delivered`)
        .set(authHeader())
        .attach('deliveryProof', Buffer.from('fake-image'), {
          contentType: 'image/jpeg',
          filename: 'proof.jpg',
        });
      expect(getOrderMocks().markOrderDelivered).toHaveBeenCalledWith(
        'deliveryDriver',
        ORDER_ID,
        'driver-1',
        'https://cdn/delivery/proof.jpg',
      );
    });

    it('returns 403 for admin without calling markOrderDelivered', async () => {
      mockAuthenticatedUser('admin-1', 'admin');
      const res = await request(app)
        .patch('/api/delivery/orders/' + ORDER_ID + '/delivered')
        .set(authHeader())
        .attach('deliveryProof', Buffer.from('fake-image'), {
          contentType: 'image/jpeg',
          filename: 'proof.jpg',
        });
      expect(res.status).toBe(403);
      expect(getOrderMocks().markOrderDelivered).not.toHaveBeenCalled();
    });
  });

  describe('store scoping on admin order mutations', () => {
    const assignBody = { deliveryUserId: '22222222-2222-2222-2222-222222222222' };

    it('returns 403 when admin has no store on assign-delivery', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: null });
      const res = await request(app)
        .post(`/api/admin/orders/${ORDER_ID}/assign-delivery`)
        .set(authHeader())
        .send(assignBody);
      expect(res.status).toBe(403);
      expect(getOrderMocks().assignOrderToDelivery).not.toHaveBeenCalled();
    });

    it('returns 403 when admin assigns delivery on another store order', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: 'store-1' });
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        id: ORDER_ID,
        status: 'readyForDelivery',
        storeId: 'store-2',
        userId: 'u1',
        products: [],
        totalAmount: 0,
      });
      const res = await request(app)
        .post(`/api/admin/orders/${ORDER_ID}/assign-delivery`)
        .set(authHeader())
        .send(assignBody);
      expect(res.status).toBe(403);
      expect(getOrderMocks().assignOrderToDelivery).not.toHaveBeenCalled();
    });

    it('allows admin to assign delivery on own store order', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: 'store-1' });
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        id: ORDER_ID,
        status: 'readyForDelivery',
        storeId: 'store-1',
        userId: 'u1',
        products: [],
        totalAmount: 0,
      });
      const res = await request(app)
        .post(`/api/admin/orders/${ORDER_ID}/assign-delivery`)
        .set(authHeader())
        .send(assignBody);
      expect(res.status).toBe(200);
      expect(getOrderMocks().assignOrderToDelivery).toHaveBeenCalled();
    });

    it('allows superAdmin to assign delivery on any store order', async () => {
      mockAuthenticatedUser('super-1', 'superAdmin', { storeId: null });
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        id: ORDER_ID,
        status: 'readyForDelivery',
        storeId: 'store-2',
        userId: 'u1',
        products: [],
        totalAmount: 0,
      });
      const res = await request(app)
        .post(`/api/admin/orders/${ORDER_ID}/assign-delivery`)
        .set(authHeader())
        .send(assignBody);
      expect(res.status).toBe(200);
      expect(getOrderMocks().assignOrderToDelivery).toHaveBeenCalled();
    });

    it('returns 403 when admin has no store on status patch', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: null });
      const res = await request(app)
        .patch(`/api/admin/orders/${ORDER_ID}/status`)
        .set(authHeader())
        .send({ status: 'preparing' });
      expect(res.status).toBe(403);
      expect(getOrderMocks().adminSetOrderStatus).not.toHaveBeenCalled();
    });

    it('returns 403 when admin patches status of another store order', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: 'store-1' });
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        id: ORDER_ID,
        status: 'paymentConfirmed',
        storeId: 'store-2',
        userId: 'u1',
        products: [],
        totalAmount: 0,
      });
      const res = await request(app)
        .patch(`/api/admin/orders/${ORDER_ID}/status`)
        .set(authHeader())
        .send({ status: 'preparing' });
      expect(res.status).toBe(403);
      expect(getOrderMocks().adminSetOrderStatus).not.toHaveBeenCalled();
    });
  });
});
