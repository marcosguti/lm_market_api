import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { verifyMobilePayment } from '../verifyMobilePayment.js';

vi.mock('../../../config/megasoft.js', () => ({
  megasoftConfig: { enabled: false, baseUrl: '', certHardcoded: false },
  megasoftCertP2cPayload: {},
  resolveMegasoftAmount: vi.fn(),
}));

vi.mock('../../../prisma.js', () => ({
  default: {
    order: { findUnique: vi.fn() },
  },
}));

vi.mock('../../../services/orderService.js', () => ({
  notifyOrderPaid: vi.fn(),
  verifyMobilePaymentP2c: vi.fn(),
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

describe('verifyMobilePayment controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 when Megasoft is disabled', async () => {
    const req = { body: {}, params: { id: 'order-1' } } as unknown as AuthRequest;
    const res = mockRes();
    await verifyMobilePayment(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Verificación automática de pago móvil no disponible' });
  });
});
