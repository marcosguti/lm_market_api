import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { emitKitchenOrderUpdated, emitOrderUpdated } from '../../../realtime/socket.js';
import { startDeliveryOrder } from '../startOrderDelivering.js';

const notifyOrderStatusChange = vi.fn();
const getAnyOrderById = vi.fn();
const startOrderDelivering = vi.fn();

vi.mock('../../../realtime/socket.js', () => ({
  emitKitchenOrderUpdated: vi.fn(),
  emitOrderUpdated: vi.fn(),
  emitUserNotification: vi.fn(),
}));

vi.mock('../../../services/orderService.js', () => ({
  getAnyOrderById: (...args: unknown[]) => getAnyOrderById(...args),
  notifyOrderStatusChange: (...args: unknown[]) => notifyOrderStatusChange(...args),
  startOrderDelivering: (...args: unknown[]) => startOrderDelivering(...args),
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

describe('startDeliveryOrder controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnyOrderById.mockResolvedValue({
      id: 'o1',
      status: 'assignedToDeliveryDriver',
      userId: 'client-1',
      deliveryUserId: 'driver-1',
      totalAmount: 25,
    });
    startOrderDelivering.mockResolvedValue({
      id: 'o1',
      status: 'delivering',
      userId: 'client-1',
      deliveryUserId: 'driver-1',
      totalAmount: 25,
    });
    notifyOrderStatusChange.mockResolvedValue(undefined);
  });

  it('emits order:updated to client, kitchen and assigned driver', async () => {
    const req = {
      params: { id: 'o1' },
      userId: 'admin-1',
      userType: 'admin',
    } as AuthRequest;
    const res = mockRes();

    await startDeliveryOrder(req, res);

    expect(res.statusCode).toBe(200);
    const payload = { id: 'o1', status: 'delivering', totalAmount: 25 };
    expect(notifyOrderStatusChange).toHaveBeenCalled();
    expect(emitOrderUpdated).toHaveBeenCalledWith('client-1', payload);
    expect(emitKitchenOrderUpdated).toHaveBeenCalledWith(payload);
    expect(emitOrderUpdated).toHaveBeenCalledWith('driver-1', payload);
  });
});
