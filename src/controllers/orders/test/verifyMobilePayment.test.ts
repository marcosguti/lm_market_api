import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../../config/megasoft.js', () => ({
  megasoftConfig: {
    enabled: true,
    baseUrl: 'https://megasoft.test',
    certHardcoded: false,
    affiliationCode: 'AFF',
    merchantBankCode: '0105',
    merchantPhone: '04140000000',
    merchantCid: 'V1',
    amountOverride: null,
  },
  megasoftCertP2cPayload: {},
  resolveMegasoftAmount: async (amount: number) => amount,
}));

vi.mock('../../../prisma.js', () => ({
  default: {
    order: {
      findUnique: vi.fn().mockResolvedValue({ id: 'order-1', totalAmount: 100 }),
    },
  },
}));

vi.mock('../../../services/orderService.js', () => ({
  notifyOrderPaid: vi.fn(),
  verifyMobilePaymentP2c: vi.fn(),
}));

import '../../../routes/test/helpers/sharedMocks.js';
import '../../../routes/test/helpers/queryMocks.js';
import { authHeader, mockAuthenticatedUser } from '../../../routes/test/helpers/authHelpers.js';
import { createTestApp } from '../../../routes/test/helpers/createTestApp.js';
import { notifyOrderPaid, verifyMobilePaymentP2c } from '../../../services/orderService.js';
import prisma from '../../../prisma.js';

const app = createTestApp();

describe('verifyMobilePayment controller extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedUser('u1', 'client');
  });

  it('returns 400 for invalid body when megasoft enabled', async () => {
    const res = await request(app)
      .post('/api/orders/order-1/verify-mobile-payment')
      .set(authHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns voucher on successful verification', async () => {
    vi.mocked(verifyMobilePaymentP2c).mockResolvedValue({
      changes: [],
      order: {
        id: 'order-1',
        status: 'paymentConfirmed',
        userId: 'u1',
        totalAmount: 100,
        products: [],
      } as never,
      voucher: 'PAGO OK',
    });
    const res = await request(app)
      .post('/api/orders/order-1/verify-mobile-payment')
      .set(authHeader())
      .send({
        amount: 100,
        bankCode: '0105',
        deliveryAddress: 'Calle 123',
        deliveryLatitude: 10.48,
        deliveryLongitude: -66.9036,
        phone: '04141234567',
        nationalId: 'V12345678',
        reference: 'REF123',
      });
    expect(res.status).toBe(200);
    expect(res.body.voucher).toBe('PAGO OK');
    expect(notifyOrderPaid).toHaveBeenCalled();
    expect(prisma.order.findUnique).toHaveBeenCalled();
  });
});
