import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authHeader, mockAuthenticatedUser } from './helpers/authHelpers.js';
import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { getUserQueryMocks, resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { getOrderMocks, resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';

const app = createTestApp();
const ORDER_ID = '11111111-1111-1111-1111-111111111111';
const STORE_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STORE_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const DRIVER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

describe('RBAC admin store scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe('GET /api/admin/orders/kitchen', () => {
    it('scopes kitchen list to admin User.storeId and ignores query storeId', async () => {
      mockAuthenticatedUser('admin-2', 'admin', { storeId: STORE_2 });
      const res = await request(app)
        .get('/api/admin/orders/kitchen')
        .query({ storeId: STORE_1 })
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(getOrderMocks().listKitchenOrders).toHaveBeenCalledWith(
        1,
        20,
        'admin',
        expect.objectContaining({ storeId: STORE_2 }),
      );
    });

    it('returns empty kitchen list when admin has no storeId', async () => {
      mockAuthenticatedUser('admin-x', 'admin', { storeId: null });
      const res = await request(app).get('/api/admin/orders/kitchen').set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
      expect(getOrderMocks().listKitchenOrders).not.toHaveBeenCalled();
    });

    it('allows superAdmin to filter by query storeId', async () => {
      mockAuthenticatedUser('super-1', 'superAdmin');
      const res = await request(app)
        .get('/api/admin/orders/kitchen')
        .query({ storeId: STORE_1 })
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(getOrderMocks().listKitchenOrders).toHaveBeenCalledWith(
        1,
        20,
        'superAdmin',
        expect.objectContaining({ storeId: STORE_1 }),
      );
    });
  });

  describe('admin cannot mutate orders from another store', () => {
    beforeEach(() => {
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        id: ORDER_ID,
        products: [],
        status: 'readyForDelivery',
        storeId: STORE_1,
        totalAmount: 10,
        userId: 'client-1',
      });
    });

    it('returns 403 when admin of store 2 patches status of store 1 order', async () => {
      mockAuthenticatedUser('admin-2', 'admin', { storeId: STORE_2 });
      const res = await request(app)
        .patch(`/api/admin/orders/${ORDER_ID}/status`)
        .set(authHeader())
        .send({ status: 'cancelled', cancellationReason: 'Sin stock disponible' });
      expect(res.status).toBe(403);
      expect(getOrderMocks().adminSetOrderStatus).not.toHaveBeenCalled();
    });

    it('allows admin of store 1 to patch status of store 1 order', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: STORE_1 });
      const res = await request(app)
        .patch(`/api/admin/orders/${ORDER_ID}/status`)
        .set(authHeader())
        .send({ status: 'cancelled', cancellationReason: 'Sin stock disponible' });
      expect(res.status).toBe(200);
      expect(getOrderMocks().adminSetOrderStatus).toHaveBeenCalled();
    });

    it('returns 403 when admin of store 2 assigns delivery on store 1 order', async () => {
      mockAuthenticatedUser('admin-2', 'admin', { storeId: STORE_2 });
      const res = await request(app)
        .post(`/api/admin/orders/${ORDER_ID}/assign-delivery`)
        .set(authHeader())
        .send({ deliveryUserId: DRIVER_ID });
      expect(res.status).toBe(403);
      expect(getOrderMocks().assignOrderToDelivery).not.toHaveBeenCalled();
    });

    it('returns 403 when admin of store 2 unassigns delivery on store 1 order', async () => {
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        deliveryUserId: DRIVER_ID,
        id: ORDER_ID,
        products: [],
        status: 'assignedToDeliveryDriver',
        storeId: STORE_1,
        totalAmount: 10,
        userId: 'client-1',
      });
      mockAuthenticatedUser('admin-2', 'admin', { storeId: STORE_2 });
      const res = await request(app)
        .post(`/api/admin/orders/${ORDER_ID}/unassign-delivery`)
        .set(authHeader());
      expect(res.status).toBe(403);
      expect(getOrderMocks().unassignOrderFromDelivery).not.toHaveBeenCalled();
    });

    it('returns 403 when admin of store 2 verifies payment on store 1 order', async () => {
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        id: ORDER_ID,
        products: [],
        status: 'paymentPendingConfirmation',
        storeId: STORE_1,
        totalAmount: 10,
        userId: 'client-1',
      });
      mockAuthenticatedUser('admin-2', 'admin', { storeId: STORE_2 });
      const res = await request(app)
        .patch(`/api/admin/orders/${ORDER_ID}/verify-payment`)
        .set(authHeader())
        .send({ verify: true });
      expect(res.status).toBe(403);
      expect(getOrderMocks().verifyPaymentByAdmin).not.toHaveBeenCalled();
    });

    it('allows superAdmin to mutate order from any store', async () => {
      mockAuthenticatedUser('super-1', 'superAdmin');
      const res = await request(app)
        .patch(`/api/admin/orders/${ORDER_ID}/status`)
        .set(authHeader())
        .send({ status: 'cancelled', cancellationReason: 'Sin stock disponible' });
      expect(res.status).toBe(200);
      expect(getOrderMocks().adminSetOrderStatus).toHaveBeenCalled();
    });
  });

  describe('admin user storeId assignment', () => {
    const adminCreateBody = {
      email: 'admin2@test.com',
      firstName: 'Admin',
      lastName: 'Two',
      numberId: '999',
      numberIdType: 'V',
      storeId: STORE_2,
      type: 'admin',
    };

    it('forbids admin actor from creating another admin', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: STORE_1 });
      const res = await request(app)
        .post('/api/admin/users')
        .set(authHeader())
        .send(adminCreateBody);
      expect(res.status).toBe(403);
      expect(getUserQueryMocks().createUser).not.toHaveBeenCalled();
    });

    it('allows superAdmin to create admin with storeId', async () => {
      mockAuthenticatedUser('super-1', 'superAdmin');
      const res = await request(app)
        .post('/api/admin/users')
        .set(authHeader())
        .send(adminCreateBody);
      expect(res.status).toBe(201);
      expect(getUserQueryMocks().createUser).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE_2, type: 'admin' }),
      );
    });

    it('forbids admin actor from setting storeId on patch', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: STORE_1 });
      const res = await request(app)
        .patch('/api/admin/users/target-1')
        .set(authHeader())
        .send({ storeId: STORE_2 });
      expect(res.status).toBe(403);
      expect(getUserQueryMocks().updateUserByAdmin).not.toHaveBeenCalled();
    });

    it('creates deliveryDriver with admin storeId from auth, not body', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: STORE_1 });
      const res = await request(app).post('/api/admin/users').set(authHeader()).send({
        email: 'driver@test.com',
        firstName: 'Drv',
        lastName: 'One',
        numberId: '888',
        numberIdType: 'V',
        type: 'deliveryDriver',
      });
      expect(res.status).toBe(201);
      expect(getUserQueryMocks().createUser).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE_1, type: 'deliveryDriver' }),
      );
    });

    it('forbids admin creating deliveryDriver with storeId in body', async () => {
      mockAuthenticatedUser('admin-1', 'admin', { storeId: STORE_1 });
      const res = await request(app).post('/api/admin/users').set(authHeader()).send({
        email: 'driver2@test.com',
        firstName: 'Drv',
        lastName: 'Two',
        numberId: '777',
        numberIdType: 'V',
        storeId: STORE_2,
        type: 'deliveryDriver',
      });
      expect(res.status).toBe(403);
      expect(getUserQueryMocks().createUser).not.toHaveBeenCalled();
    });

    it('allows superAdmin to create deliveryDriver with storeId', async () => {
      mockAuthenticatedUser('super-1', 'superAdmin');
      const res = await request(app).post('/api/admin/users').set(authHeader()).send({
        email: 'driver3@test.com',
        firstName: 'Drv',
        lastName: 'Three',
        numberId: '666',
        numberIdType: 'V',
        storeId: STORE_2,
        type: 'deliveryDriver',
      });
      expect(res.status).toBe(201);
      expect(getUserQueryMocks().createUser).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE_2, type: 'deliveryDriver' }),
      );
    });
  });

  describe('GET /api/admin/orders/:id/delivery-drivers', () => {
    it('returns drivers for order store after access check', async () => {
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        id: ORDER_ID,
        products: [],
        status: 'readyForDelivery',
        storeId: STORE_1,
        totalAmount: 10,
        userId: 'client-1',
      });
      getOrderMocks().listDeliveryDriversForOrder.mockResolvedValue([
        {
          busy: true,
          email: 'busy@test.com',
          firstName: 'Busy',
          id: DRIVER_ID,
          lastName: 'Drv',
          storeId: STORE_1,
        },
      ]);
      mockAuthenticatedUser('admin-1', 'admin', { storeId: STORE_1 });
      const res = await request(app)
        .get(`/api/admin/orders/${ORDER_ID}/delivery-drivers`)
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.drivers).toHaveLength(1);
      expect(res.body.drivers[0].busy).toBe(true);
      expect(getOrderMocks().listDeliveryDriversForOrder).toHaveBeenCalledWith(ORDER_ID);
    });

    it('forbids admin of other store from listing drivers', async () => {
      getOrderMocks().getAnyOrderById.mockResolvedValue({
        id: ORDER_ID,
        products: [],
        status: 'readyForDelivery',
        storeId: STORE_1,
        totalAmount: 10,
        userId: 'client-1',
      });
      mockAuthenticatedUser('admin-2', 'admin', { storeId: STORE_2 });
      const res = await request(app)
        .get(`/api/admin/orders/${ORDER_ID}/delivery-drivers`)
        .set(authHeader());
      expect(res.status).toBe(403);
      expect(getOrderMocks().listDeliveryDriversForOrder).not.toHaveBeenCalled();
    });
  });
});
