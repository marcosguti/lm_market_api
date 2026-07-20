import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { assignDelivery } from '../assignDelivery.js';

const assertAdminCanAccessOrder = vi.fn();
const assignOrderToDelivery = vi.fn();
const getAnyOrderById = vi.fn();
const notifyDeliveryAssigned = vi.fn();
const notifyOrderStatusChange = vi.fn();

vi.mock('../../../realtime/socket.js', () => ({
  emitKitchenOrderUpdated: vi.fn(),
  emitOrderUpdated: vi.fn(),
}));

vi.mock('../../../services/orderService.js', () => ({
  assertAdminCanAccessOrder: (...args: unknown[]) => assertAdminCanAccessOrder(...args),
  assignOrderToDelivery: (...args: unknown[]) => assignOrderToDelivery(...args),
  getAnyOrderById: (...args: unknown[]) => getAnyOrderById(...args),
  notifyDeliveryAssigned: (...args: unknown[]) => notifyDeliveryAssigned(...args),
  notifyOrderStatusChange: (...args: unknown[]) => notifyOrderStatusChange(...args),
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

describe('assignDelivery notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnyOrderById.mockResolvedValue({
      id: 'o1',
      status: 'readyForDelivery',
      storeId: 's1',
      userId: 'client-1',
      totalAmount: 20,
    });
    assignOrderToDelivery.mockResolvedValue({
      id: 'o1',
      status: 'assignedToDeliveryDriver',
      userId: 'client-1',
      deliveryUserId: '11111111-1111-1111-1111-111111111111',
      totalAmount: 20,
    });
    notifyOrderStatusChange.mockResolvedValue(undefined);
    notifyDeliveryAssigned.mockResolvedValue(undefined);
  });

  it('notifies client status change and driver assignment', async () => {
    const driverId = '11111111-1111-1111-1111-111111111111';
    const req = {
      body: { deliveryUserId: driverId },
      params: { id: 'o1' },
      storeId: 's1',
      userId: 'admin-1',
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();

    await assignDelivery(req, res);

    expect(res.statusCode).toBe(200);
    expect(notifyOrderStatusChange).toHaveBeenCalled();
    expect(notifyDeliveryAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1' }),
      driverId,
    );
  });
});
