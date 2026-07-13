import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { getPaymentBanks } from '../getPaymentBanks.js';

vi.mock('../../../config/megasoft.js', () => ({
  megasoftConfig: {
    supportedBankCodes: ['0105', '0102'],
  },
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

describe('getPaymentBanks controller', () => {
  it('returns supported Venezuelan banks', async () => {
    const res = mockRes();
    await getPaymentBanks({}, res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { banks: Array<{ code: string; name: string }> };
    expect(body.banks.length).toBe(2);
    expect(body.banks.map((b) => b.code).sort()).toEqual(['0102', '0105']);
  });
});
