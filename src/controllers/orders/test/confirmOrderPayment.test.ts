import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { confirmOrderPayment } from '../confirmOrderPayment.js';

const confirmPendingOrderPaymentWithDetails = vi.fn();
const notifyOrderPaid = vi.fn();
const uploadPaymentScreenshot = vi.fn();

vi.mock('../../../config/megasoft.js', () => ({
  megasoftConfig: { enabled: false },
}));

vi.mock('../../../services/orderService.js', () => ({
  confirmPendingOrderPaymentWithDetails: (...args: unknown[]) =>
    confirmPendingOrderPaymentWithDetails(...args),
  notifyOrderPaid: (...args: unknown[]) => notifyOrderPaid(...args),
}));

vi.mock('../../../libs/filesInDigitalOcean/index.js', () => ({
  uploadPaymentScreenshot: (...args: unknown[]) => uploadPaymentScreenshot(...args),
}));

function mockRes(): Response & { statusCode: number; body?: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body?: unknown };
}

describe('confirmOrderPayment controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmPendingOrderPaymentWithDetails.mockResolvedValue({
      changes: [],
      order: { id: 'o1', status: 'paymentConfirmed' },
    });
    notifyOrderPaid.mockResolvedValue(undefined);
  });

  it('returns 403 for non-client users', async () => {
    const req = {
      userId: 'admin-1',
      userType: 'admin',
      params: { id: 'o1' },
      body: {},
    } as AuthRequest;
    const res = mockRes();
    await confirmOrderPayment(req, res);
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 when payment method is missing', async () => {
    const req = {
      body: {},
      params: { id: 'o1' },
      userId: 'client-1',
      userType: 'client',
    } as AuthRequest;
    const res = mockRes();
    await confirmOrderPayment(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when non-cash payment lacks screenshot', async () => {
    const req = {
      body: { method: 'zelle', paidAt: new Date().toISOString(), reference: 'REF1' },
      params: { id: 'o1' },
      userId: 'client-1',
      userType: 'client',
    } as AuthRequest;
    const res = mockRes();
    await confirmOrderPayment(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'El comprobante de pago es requerido' });
  });

  it('confirms cash payment without screenshot', async () => {
    const req = {
      body: { method: 'cash' },
      params: { id: 'o1' },
      userId: 'client-1',
      userType: 'client',
    } as AuthRequest;
    const res = mockRes();
    await confirmOrderPayment(req, res);
    expect(res.statusCode).toBe(200);
    expect(confirmPendingOrderPaymentWithDetails).toHaveBeenCalledWith('client-1', 'o1', {
      method: 'cash',
      paidAt: null,
      reference: null,
      screenshotUrl: null,
    });
    expect(notifyOrderPaid).toHaveBeenCalled();
  });
});
