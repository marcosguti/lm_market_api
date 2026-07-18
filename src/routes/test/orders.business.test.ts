import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../../config/megasoft.js', () => ({
  megasoftCertP2cPayload: {},
  megasoftConfig: {
    affiliationCode: 'TEST',
    baseUrl: 'http://megasoft.test',
    certHardcoded: false,
    enabled: true,
    merchantBankCode: '0105',
    merchantCid: '',
    merchantPhone: '04141234567',
  },
  resolveMegasoftAmount: async (amount: number) => amount,
}));

import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { getOrderMocks, resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { mockAuthenticatedUser, authHeader } from './helpers/authHelpers.js';
import { createTestApp } from './helpers/createTestApp.js';
import { OrderDomainError } from '../../services/orderService.js';

const app = createTestApp();
const orderMocks = getOrderMocks();

describe('Orders business integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    mockAuthenticatedUser('client-1', 'client');
  });

  describe('GET /api/orders/cart', () => {
    it('returns cart order for client', async () => {
      orderMocks.ensurePendingCart.mockResolvedValue({
        changes: [],
        order: { id: 'cart-1', products: [], status: 'pending', totalAmount: 0 },
      });
      const res = await request(app).get('/api/orders/cart').set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.order.id).toBe('cart-1');
      expect(orderMocks.ensurePendingCart).toHaveBeenCalledWith('client-1', undefined);
    });
  });

  describe('GET /api/orders/history', () => {
    it('returns paginated history', async () => {
      orderMocks.getUserOrderHistory.mockResolvedValue({
        data: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
      });
      const res = await request(app).get('/api/orders/history').set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });
  });

  describe('PATCH /api/orders/:id/lines', () => {
    it('returns 400 when lines are missing', async () => {
      const res = await request(app).patch('/api/orders/o1/lines').set(authHeader()).send({});
      expect(res.status).toBe(400);
    });

    it('returns order payload on success', async () => {
      orderMocks.updatePendingOrderLines.mockResolvedValue({
        changes: [],
        order: { id: 'o1', products: [], status: 'pending', totalAmount: 0 },
      });
      const res = await request(app)
        .patch('/api/orders/o1/lines')
        .set(authHeader())
        .send({ lines: [{ code: 'SKU1', quantity: 2 }] });
      expect(res.status).toBe(200);
      expect(res.body.order.id).toBe('o1');
    });

    it('maps OrderDomainError to status code', async () => {
      orderMocks.updatePendingOrderLines.mockRejectedValue(
        new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404),
      );
      const res = await request(app)
        .patch('/api/orders/missing/lines')
        .set(authHeader())
        .send({ lines: [{ code: 'SKU1', quantity: 1 }] });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('POST /api/orders/:id/confirm-payment', () => {
    it('returns 400 when deliveryAddress is missing', async () => {
      const res = await request(app)
        .post('/api/orders/o1/confirm-payment')
        .set(authHeader())
        .send({ method: 'cash' });
      expect(res.status).toBe(400);
      expect(orderMocks.confirmPendingOrderPaymentWithDetails).not.toHaveBeenCalled();
    });

    it('returns 400 when cash payment lacks screenshot', async () => {
      const res = await request(app).post('/api/orders/o1/confirm-payment').set(authHeader()).send({
        deliveryAddress: 'Calle 123',
        deliveryLatitude: 10.48,
        deliveryLongitude: -66.9036,
        method: 'cash',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/comprobante/i);
      expect(orderMocks.confirmPendingOrderPaymentWithDetails).not.toHaveBeenCalled();
    });

    it('returns 400 when non-cash payment lacks screenshot', async () => {
      const res = await request(app).post('/api/orders/o1/confirm-payment').set(authHeader()).send({
        deliveryAddress: 'Calle 123',
        deliveryLatitude: 10.48,
        deliveryLongitude: -66.9036,
        method: 'zelle',
        reference: 'REF1',
        paidAt: new Date().toISOString(),
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/comprobante/i);
    });

    it('returns 200 for cash with screenshot', async () => {
      orderMocks.confirmPendingOrderPaymentWithDetails.mockResolvedValue({
        changes: [],
        order: {
          id: 'o1',
          status: 'paymentPendingConfirmation',
          products: [],
          totalAmount: 10,
          userId: 'u1',
        },
      });
      const res = await request(app)
        .post('/api/orders/o1/confirm-payment')
        .set(authHeader())
        .attach('screenshot', Buffer.from('fake-image'), {
          contentType: 'image/jpeg',
          filename: 'proof.jpg',
        })
        .field('deliveryAddress', 'Calle 123')
        .field('deliveryLatitude', '10.48')
        .field('deliveryLongitude', '-66.9036')
        .field('method', 'cash');
      expect(res.status).toBe(200);
      expect(orderMocks.confirmPendingOrderPaymentWithDetails).toHaveBeenCalled();
    });

    it('returns 200 for zelle with screenshot upload mocked via service', async () => {
      orderMocks.confirmPendingOrderPaymentWithDetails.mockResolvedValue({
        changes: [],
        order: {
          id: 'o1',
          status: 'paymentPendingConfirmation',
          products: [],
          totalAmount: 10,
          userId: 'u1',
        },
      });
      const res = await request(app)
        .post('/api/orders/o1/confirm-payment')
        .set(authHeader())
        .attach('screenshot', Buffer.from('fake-image'), {
          contentType: 'image/jpeg',
          filename: 'proof.jpg',
        })
        .field('deliveryAddress', 'Calle 123')
        .field('deliveryLatitude', '10.48')
        .field('deliveryLongitude', '-66.9036')
        .field('method', 'zelle')
        .field('reference', 'REF1')
        .field('paidAt', new Date().toISOString());
      expect(res.status).toBe(200);
      expect(orderMocks.confirmPendingOrderPaymentWithDetails).toHaveBeenCalled();
    });

    it('maps OrderDomainError from confirm payment to HTTP status', async () => {
      orderMocks.confirmPendingOrderPaymentWithDetails.mockRejectedValue(
        new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409),
      );
      const res = await request(app)
        .post('/api/orders/o1/confirm-payment')
        .set(authHeader())
        .attach('screenshot', Buffer.from('fake-image'), {
          contentType: 'image/jpeg',
          filename: 'proof.jpg',
        })
        .field('deliveryAddress', 'Calle 123')
        .field('deliveryLatitude', '10.48')
        .field('deliveryLongitude', '-66.9036')
        .field('method', 'cash');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ORDER_NOT_PENDING');
    });
  });

  describe('POST /api/orders/:id/verify-mobile-payment', () => {
    it('returns 400 when body is invalid', async () => {
      const res = await request(app)
        .post('/api/orders/o1/verify-mobile-payment')
        .set(authHeader())
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns voucher on successful P2C verification', async () => {
      orderMocks.verifyMobilePaymentP2c.mockResolvedValue({
        changes: [],
        order: { id: 'o1', status: 'paymentConfirmed' },
        voucher: 'PAGO OK',
      });
      const res = await request(app)
        .post('/api/orders/o1/verify-mobile-payment')
        .set(authHeader())
        .send({
          amount: 100,
          bankCode: '0105',
          deliveryAddress: 'Calle 123',
          deliveryLatitude: 10.48,
          deliveryLongitude: -66.9036,
          nationalId: 'V12345678',
          phone: '04141234567',
          reference: 'REF123',
        });
      expect(res.status).toBe(200);
      expect(res.body.voucher).toBe('PAGO OK');
    });

    it('maps Megasoft rejection to 400', async () => {
      orderMocks.verifyMobilePaymentP2c.mockRejectedValue(
        new OrderDomainError('PAYMENT_REJECTED', 'Pago rechazado', 400),
      );
      const res = await request(app)
        .post('/api/orders/o1/verify-mobile-payment')
        .set(authHeader())
        .send({
          amount: 100,
          bankCode: '0105',
          deliveryAddress: 'Calle 123',
          deliveryLatitude: 10.48,
          deliveryLongitude: -66.9036,
          nationalId: 'V12345678',
          phone: '04141234567',
          reference: 'REF123',
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PAYMENT_REJECTED');
    });
  });
});
