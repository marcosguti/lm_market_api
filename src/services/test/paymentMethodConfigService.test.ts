import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getActivePaymentMethodConfigs,
  toPublicPaymentMethodConfig,
} from '../paymentMethodConfigService.js';

const findMany = vi.fn();

vi.mock('../../prisma.js', () => ({
  default: {
    paymentMethodConfig: {
      findMany: (...args: unknown[]) => findMany(...args),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('paymentMethodConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps config to public shape', () => {
    const publicConfig = toPublicPaymentMethodConfig({
      active: true,
      information: 'Datos Zelle',
      method: 'zelle',
      noteEnabled: true,
      placeholder: 'Comprobante',
      updatedAt: new Date(),
    });
    expect(publicConfig).toEqual({
      information: 'Datos Zelle',
      method: 'zelle',
      noteEnabled: true,
      placeholder: 'Comprobante',
    });
  });

  it('returns active methods in stable order', async () => {
    findMany.mockResolvedValue([
      {
        active: true,
        information: null,
        method: 'binance',
        noteEnabled: true,
        placeholder: null,
        updatedAt: new Date(),
      },
      {
        active: true,
        information: null,
        method: 'cash',
        noteEnabled: true,
        placeholder: 'Foto del billete',
        updatedAt: new Date(),
      },
      {
        active: true,
        information: 'PM',
        method: 'mobilePayment',
        noteEnabled: false,
        placeholder: null,
        updatedAt: new Date(),
      },
      {
        active: true,
        information: 'Zelle',
        method: 'zelle',
        noteEnabled: true,
        placeholder: null,
        updatedAt: new Date(),
      },
    ]);

    const methods = await getActivePaymentMethodConfigs();
    expect(findMany).toHaveBeenCalledWith({ where: { active: true } });
    expect(methods.map((m) => m.method)).toEqual(['cash', 'zelle', 'mobilePayment', 'binance']);
  });
});
