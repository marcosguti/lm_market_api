import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { OrderDomainError } from '../../../services/orderService.js';
import { patchAdminOrderStatus } from '../../adminOrders/patchAdminOrderStatus.js';

const adminSetOrderStatus = vi.fn();
const createOrderStatusNotification = vi.fn();
const getAnyOrderById = vi.fn();

vi.mock('../../../realtime/socket.js', () => ({
  emitDeliveryOrderCancelled: vi.fn(),
  emitOrderCancelled: vi.fn(),
  emitOrderUpdated: vi.fn(),
  emitUserNotification: vi.fn(),
}));

vi.mock('../../../services/orderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/orderService.js')>();
  return {
    ...actual,
    adminSetOrderStatus: (...args: unknown[]) => adminSetOrderStatus(...args),
    createOrderStatusNotification: (...args: unknown[]) => createOrderStatusNotification(...args),
    getAnyOrderById: (...args: unknown[]) => getAnyOrderById(...args),
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

describe('patchAdminOrderStatus controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnyOrderById.mockResolvedValue({
      id: 'o1',
      status: 'paymentConfirmed',
      userId: 'client-1',
      totalAmount: 10,
      products: [],
    });
    adminSetOrderStatus.mockResolvedValue({
      id: 'o1',
      status: 'preparing',
      userId: 'client-1',
      totalAmount: 10,
      products: [],
    });
    createOrderStatusNotification.mockResolvedValue(undefined);
  });

  it('returns 400 for invalid status value', async () => {
    const req = {
      body: { status: 'not-a-status' },
      params: { id: 'o1' },
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(400);
    expect(adminSetOrderStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when order does not exist', async () => {
    getAnyOrderById.mockResolvedValue(null);
    const req = {
      body: { status: 'preparing' },
      params: { id: 'missing' },
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('updates order status on valid transition', async () => {
    const req = {
      body: { status: 'preparing' },
      params: { id: 'o1' },
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(200);
    expect(adminSetOrderStatus).toHaveBeenCalledWith('o1', 'preparing');
    expect(createOrderStatusNotification).toHaveBeenCalled();
  });

  it('maps OrderDomainError to HTTP status', async () => {
    adminSetOrderStatus.mockRejectedValue(
      new OrderDomainError('INVALID_STATUS_TRANSITION', 'Transición inválida', 400),
    );
    const req = {
      body: { status: 'delivered' },
      params: { id: 'o1' },
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });
});
