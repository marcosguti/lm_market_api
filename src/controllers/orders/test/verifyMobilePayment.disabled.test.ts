import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/megasoft.js', () => ({
  megasoftConfig: { enabled: false },
  megasoftCertP2cPayload: {},
  resolveMegasoftAmount: vi.fn(),
}));

import type { AuthRequest } from '../../../middlewares/auth.js';
import { verifyMobilePayment } from '../verifyMobilePayment.js';

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

describe('verifyMobilePayment disabled', () => {
  it('returns 503 when Megasoft is disabled', async () => {
    const req = {
      body: {},
      params: { id: 'order-1' },
      userId: 'u1',
      userType: 'client',
    } as unknown as AuthRequest;
    const res = mockRes();
    await verifyMobilePayment(req, res);
    expect(res.statusCode).toBe(503);
  });
});
