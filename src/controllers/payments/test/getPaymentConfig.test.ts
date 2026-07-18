import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPaymentConfig } from '../getPaymentBanks.js';

const getActivePaymentMethodConfigs = vi.fn();

vi.mock('../../../config/megasoft.js', () => ({
  megasoftConfig: {
    enabled: true,
    merchantBankCode: '0105',
    merchantBankName: 'Mercantil',
    merchantPhone: '04141234567',
    merchantRif: 'J123',
    supportedBankCodes: ['0105'],
  },
}));

vi.mock('../../../services/bcvExchangeRate.js', () => ({
  getUsdVesRateInfo: vi.fn().mockResolvedValue({
    fetchedAt: new Date('2026-07-18T12:00:00.000Z'),
    rate: 36.5,
    source: 'bcv',
  }),
}));

vi.mock('../../../services/paymentMethodConfigService.js', () => ({
  getActivePaymentMethodConfigs: (...args: unknown[]) => getActivePaymentMethodConfigs(...args),
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

describe('getPaymentConfig controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActivePaymentMethodConfigs.mockResolvedValue([
      {
        information: null,
        method: 'cash',
        noteEnabled: true,
        placeholder: 'Toma una foto legible del billete',
      },
    ]);
  });

  it('returns methods first in the payload', async () => {
    const res = mockRes();
    await getPaymentConfig({}, res);
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body)[0]).toBe('methods');
    expect(body.methods).toEqual([
      {
        information: null,
        method: 'cash',
        noteEnabled: true,
        placeholder: 'Toma una foto legible del billete',
      },
    ]);
    expect(body.megasoftEnabled).toBe(true);
    expect(body.usdRate).toBe(36.5);
  });
});
