import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { sendOrderCancelledEmail } from '../../../libs/sendEmail/index.js';
import { findUserById } from '../../../queries/user.js';
import { OrderDomainError } from '../../../services/orderService.js';
import { patchAdminOrderStatus } from '../../adminOrders/patchAdminOrderStatus.js';

const adminSetOrderStatus = vi.fn();
const notifyOrderStatusChange = vi.fn();
const notifyDeliveryCancelled = vi.fn();
const getAnyOrderById = vi.fn();

vi.mock('../../../realtime/socket.js', () => ({
  emitDeliveryOrderCancelled: vi.fn(),
  emitOrderCancelled: vi.fn(),
  emitOrderUpdated: vi.fn(),
  emitUserNotification: vi.fn(),
}));

vi.mock('../../../libs/sendEmail/index.js', () => ({
  sendOrderCancelledEmail: vi.fn(),
}));

vi.mock('../../../queries/user.js', () => ({
  findUserById: vi.fn(),
}));

vi.mock('../../../services/orderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/orderService.js')>();
  return {
    ...actual,
    adminSetOrderStatus: (...args: unknown[]) => adminSetOrderStatus(...args),
    getAnyOrderById: (...args: unknown[]) => getAnyOrderById(...args),
    notifyDeliveryCancelled: (...args: unknown[]) => notifyDeliveryCancelled(...args),
    notifyOrderStatusChange: (...args: unknown[]) => notifyOrderStatusChange(...args),
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
    notifyOrderStatusChange.mockResolvedValue(undefined);
    notifyDeliveryCancelled.mockResolvedValue(undefined);
    vi.mocked(findUserById).mockResolvedValue({
      email: 'client@test.com',
      firstName: 'Cliente',
      id: 'client-1',
    } as never);
    vi.mocked(sendOrderCancelledEmail).mockResolvedValue(undefined);
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
      userId: 'admin-1',
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(200);
    expect(adminSetOrderStatus).toHaveBeenCalledWith('o1', 'preparing', 'admin-1', undefined);
    expect(notifyOrderStatusChange).toHaveBeenCalled();
  });

  it('notifies assigned driver when order is cancelled', async () => {
    getAnyOrderById.mockResolvedValue({
      id: 'o1',
      status: 'assignedToDeliveryDriver',
      userId: 'client-1',
      deliveryUserId: 'driver-1',
      totalAmount: 10,
      products: [],
    });
    adminSetOrderStatus.mockResolvedValue({
      id: 'o1',
      status: 'cancelled',
      userId: 'client-1',
      deliveryUserId: null,
      totalAmount: 10,
      products: [],
      cancellationReason: 'Sin stock',
    });
    const req = {
      body: { status: 'cancelled', cancellationReason: 'Sin stock' },
      params: { id: 'o1' },
      userId: 'admin-1',
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(200);
    expect(notifyDeliveryCancelled).toHaveBeenCalledWith('o1', 'driver-1');
  });

  it('cancels with reason and sends email to client', async () => {
    adminSetOrderStatus.mockResolvedValue({
      id: 'a5350180-1234-5678-9abc-def012345678',
      status: 'cancelled',
      userId: 'client-1',
      deliveryUserId: null,
      totalAmount: 10,
      products: [],
      cancellationReason: 'Sin stock del producto',
    });
    const req = {
      body: { status: 'cancelled', cancellationReason: 'Sin stock del producto' },
      params: { id: 'a5350180-1234-5678-9abc-def012345678' },
      userId: 'admin-1',
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(200);
    expect(adminSetOrderStatus).toHaveBeenCalledWith(
      'a5350180-1234-5678-9abc-def012345678',
      'cancelled',
      'admin-1',
      'Sin stock del producto',
    );
    expect(sendOrderCancelledEmail).toHaveBeenCalledWith({
      email: 'client@test.com',
      firstName: 'Cliente',
      reason: 'Sin stock del producto',
      shortOrderId: '#a5350180',
    });
  });

  it('still returns 200 if cancellation email fails', async () => {
    adminSetOrderStatus.mockResolvedValue({
      id: 'o1',
      status: 'cancelled',
      userId: 'client-1',
      deliveryUserId: null,
      totalAmount: 10,
      products: [],
      cancellationReason: 'Error de inventario',
    });
    vi.mocked(sendOrderCancelledEmail).mockRejectedValue(new Error('mailjet down'));
    const req = {
      body: { status: 'cancelled', cancellationReason: 'Error de inventario' },
      params: { id: 'o1' },
      userId: 'admin-1',
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('maps OrderDomainError to HTTP status', async () => {
    adminSetOrderStatus.mockRejectedValue(
      new OrderDomainError('INVALID_STATUS_TRANSITION', 'Transición inválida', 400),
    );
    const req = {
      body: { status: 'readyForDelivery' },
      params: { id: 'o1' },
      userId: 'admin-1',
      userType: 'superAdmin',
    } as AuthRequest;
    const res = mockRes();
    await patchAdminOrderStatus(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });
});
