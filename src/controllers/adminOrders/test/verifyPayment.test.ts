import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { verifyPayment } from '../verifyPayment.js';

const verifyPaymentByAdmin = vi.fn();

vi.mock('../../../services/orderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/orderService.js')>();
  return {
    ...actual,
    verifyPaymentByAdmin: (...args: unknown[]) => verifyPaymentByAdmin(...args),
  };
});

import { OrderDomainError } from '../../../services/orderService.js';

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

describe('verifyPayment controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyPaymentByAdmin.mockResolvedValue({ id: 'o1', status: 'paymentConfirmed', products: [] });
  });

  it('returns 401 without userId', async () => {
    const req = { body: { verify: true }, params: { id: 'o1' } } as AuthRequest;
    const res = mockRes();
    await verifyPayment(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when verify is not boolean', async () => {
    const req = {
      body: { verify: 'yes' },
      params: { id: 'o1' },
      userId: 'admin-1',
    } as AuthRequest;
    const res = mockRes();
    await verifyPayment(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns order when verification succeeds', async () => {
    const req = {
      body: { verify: true },
      params: { id: 'o1' },
      userId: 'admin-1',
    } as AuthRequest;
    const res = mockRes();
    await verifyPayment(req, res);
    expect(res.statusCode).toBe(200);
    expect(verifyPaymentByAdmin).toHaveBeenCalledWith('o1', 'admin-1', true);
  });

  it('maps OrderDomainError to HTTP status', async () => {
    verifyPaymentByAdmin.mockRejectedValue(
      new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404),
    );
    const req = {
      body: { verify: false },
      params: { id: 'missing' },
      userId: 'admin-1',
    } as AuthRequest;
    const res = mockRes();
    await verifyPayment(req, res);
    expect(res.statusCode).toBe(404);
  });
});
