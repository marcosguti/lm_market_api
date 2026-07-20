import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { confirmOrderPayment } from '../confirmOrderPayment.js';

const confirmPendingOrderPaymentWithDetails = vi.fn();
const notifyOrderStatusChange = vi.fn();
const uploadPaymentScreenshot = vi.fn();
const emitKitchenOrderUpdated = vi.fn();
const emitOrderUpdated = vi.fn();

vi.mock('../../../config/megasoft.js', () => ({
  megasoftConfig: { enabled: false },
}));

vi.mock('../../../services/orderService.js', () => ({
  confirmPendingOrderPaymentWithDetails: (...args: unknown[]) =>
    confirmPendingOrderPaymentWithDetails(...args),
  notifyOrderStatusChange: (...args: unknown[]) => notifyOrderStatusChange(...args),
}));

vi.mock('../../../libs/filesInDigitalOcean/index.js', () => ({
  uploadPaymentScreenshot: (...args: unknown[]) => uploadPaymentScreenshot(...args),
}));

vi.mock('../../../realtime/socket.js', () => ({
  emitKitchenOrderUpdated: (...args: unknown[]) => emitKitchenOrderUpdated(...args),
  emitOrderUpdated: (...args: unknown[]) => emitOrderUpdated(...args),
  emitUserNotification: vi.fn(),
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
      order: {
        id: 'o1',
        status: 'paymentPendingConfirmation',
        totalAmount: 10,
        userId: 'client-1',
      },
    });
    notifyOrderStatusChange.mockResolvedValue(undefined);
    uploadPaymentScreenshot.mockResolvedValue('https://cdn.example/proof.jpg');
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

  it('returns 400 when payment lacks screenshot', async () => {
    const req = {
      body: {
        deliveryAddress: 'Calle 123',
        deliveryLatitude: 10.48,
        deliveryLongitude: -66.9036,
        method: 'zelle',
        paidAt: new Date().toISOString(),
        reference: 'REF1',
      },
      params: { id: 'o1' },
      userId: 'client-1',
      userType: 'client',
    } as AuthRequest;
    const res = mockRes();
    await confirmOrderPayment(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'El comprobante de pago es requerido' });
  });

  it('returns 400 when cash payment lacks screenshot', async () => {
    const req = {
      body: {
        deliveryAddress: 'Calle 123',
        deliveryLatitude: 10.48,
        deliveryLongitude: -66.9036,
        method: 'cash',
      },
      params: { id: 'o1' },
      userId: 'client-1',
      userType: 'client',
    } as AuthRequest;
    const res = mockRes();
    await confirmOrderPayment(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'El comprobante de pago es requerido' });
    expect(confirmPendingOrderPaymentWithDetails).not.toHaveBeenCalled();
  });

  it('confirms cash payment with screenshot to paymentPendingConfirmation', async () => {
    const req = {
      body: { method: 'cash' },
      file: {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
      },
      params: { id: 'o1' },
      userId: 'client-1',
      userType: 'client',
    } as AuthRequest;
    const res = mockRes();
    await confirmOrderPayment(req, res);
    expect(res.statusCode).toBe(200);
    expect(uploadPaymentScreenshot).toHaveBeenCalled();
    expect(confirmPendingOrderPaymentWithDetails).toHaveBeenCalledWith('client-1', 'o1', {
      deliveryAddress: null,
      deliveryLatitude: undefined,
      deliveryLongitude: undefined,
      method: 'cash',
      note: null,
      paidAt: null,
      reference: null,
      screenshotUrl: 'https://cdn.example/proof.jpg',
    });
    expect(notifyOrderStatusChange).toHaveBeenCalled();
    expect(emitKitchenOrderUpdated).toHaveBeenCalled();
    expect(emitOrderUpdated).toHaveBeenCalled();
  });
});
