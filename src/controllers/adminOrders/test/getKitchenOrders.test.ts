import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { StoreNotFoundError } from '../../../queries/store.js';
import { getKitchenOrders } from '../getKitchenOrders.js';

const listKitchenOrders = vi.fn();
const assertStoreActive = vi.fn();

vi.mock('../../../services/orderService.js', () => ({
  listKitchenOrders: (...args: unknown[]) => listKitchenOrders(...args),
}));

vi.mock('../../../queries/store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../queries/store.js')>();
  return {
    ...actual,
    assertStoreActive: (...args: unknown[]) => assertStoreActive(...args),
  };
});

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

describe('getKitchenOrders controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertStoreActive.mockResolvedValue(undefined);
    listKitchenOrders.mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
  });

  it('returns 400 for invalid status filter', async () => {
    const req = {
      query: { status: 'not-a-status' },
      userType: 'admin',
    } as unknown as AuthRequest;
    const res = mockRes();

    await getKitchenOrders(req, res);

    expect(res.statusCode).toBe(400);
    expect(listKitchenOrders).not.toHaveBeenCalled();
  });

  it('returns 400 when createdTo is before createdFrom', async () => {
    const req = {
      query: {
        createdFrom: '2026-07-13',
        createdTo: '2026-07-01',
      },
      userType: 'admin',
    } as unknown as AuthRequest;
    const res = mockRes();

    await getKitchenOrders(req, res);

    expect(res.statusCode).toBe(400);
    expect(listKitchenOrders).not.toHaveBeenCalled();
  });

  it('passes filters to listKitchenOrders', async () => {
    const req = {
      query: {
        createdFrom: '2026-07-01',
        createdTo: '2026-07-13',
        id: 'abc-123',
        page: '2',
        pageSize: '50',
        status: 'preparing',
        storeId: 'store-1',
      },
      userType: 'admin',
    } as unknown as AuthRequest;
    const res = mockRes();

    await getKitchenOrders(req, res);

    expect(assertStoreActive).toHaveBeenCalledWith('store-1');
    expect(res.statusCode).toBe(200);
    expect(listKitchenOrders).toHaveBeenCalledWith(2, 50, 'admin', {
      createdFrom: expect.any(Date),
      createdTo: expect.any(Date),
      id: 'abc-123',
      status: 'preparing',
      storeId: 'store-1',
    });
  });

  it('returns 400 when storeId is inactive', async () => {
    assertStoreActive.mockRejectedValue(new StoreNotFoundError());
    const req = {
      query: { storeId: 'inactive-store' },
      userType: 'admin',
    } as unknown as AuthRequest;
    const res = mockRes();

    await getKitchenOrders(req, res);

    expect(res.statusCode).toBe(400);
    expect(listKitchenOrders).not.toHaveBeenCalled();
  });

  it('maps empty string filters to undefined', async () => {
    const req = {
      query: {
        id: '',
        storeId: '',
      },
      userType: 'superAdmin',
    } as unknown as AuthRequest;
    const res = mockRes();

    await getKitchenOrders(req, res);

    expect(assertStoreActive).not.toHaveBeenCalled();
    expect(listKitchenOrders).toHaveBeenCalledWith(1, 20, 'superAdmin', {
      createdFrom: undefined,
      createdTo: undefined,
      id: undefined,
      status: 'all',
      storeId: undefined,
    });
  });
});
