import { vi } from 'vitest';

const orderMocks = vi.hoisted(() => ({
  adminSetOrderStatus: vi.fn(),
  claimDeliveryOrder: vi.fn(),
  confirmPendingOrderPaymentWithDetails: vi.fn(),
  createOrderStatusNotification: vi.fn(),
  ensurePendingCart: vi.fn(),
  getAnyOrderById: vi.fn(),
  getOrderByIdForUser: vi.fn(),
  getUserOrderHistory: vi.fn(),
  listDeliveryAvailable: vi.fn(),
  listDeliveryMine: vi.fn(),
  listKitchenOrders: vi.fn(),
  listNotificationsForUser: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markOrderDelivered: vi.fn(),
  notifyOrderPaid: vi.fn(),
  updatePendingOrderLines: vi.fn(),
  verifyMobilePaymentP2c: vi.fn(),
  verifyPaymentByAdmin: vi.fn(),
}));

vi.mock('../../../services/orderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/orderService.js')>();
  return {
    ...actual,
    adminSetOrderStatus: orderMocks.adminSetOrderStatus,
    claimDeliveryOrder: orderMocks.claimDeliveryOrder,
    confirmPendingOrderPaymentWithDetails: orderMocks.confirmPendingOrderPaymentWithDetails,
    createOrderStatusNotification: orderMocks.createOrderStatusNotification,
    ensurePendingCart: orderMocks.ensurePendingCart,
    getAnyOrderById: orderMocks.getAnyOrderById,
    getOrderByIdForUser: orderMocks.getOrderByIdForUser,
    getUserOrderHistory: orderMocks.getUserOrderHistory,
    listDeliveryAvailable: orderMocks.listDeliveryAvailable,
    listDeliveryMine: orderMocks.listDeliveryMine,
    listKitchenOrders: orderMocks.listKitchenOrders,
    listNotificationsForUser: orderMocks.listNotificationsForUser,
    markAllNotificationsAsRead: orderMocks.markAllNotificationsAsRead,
    markNotificationAsRead: orderMocks.markNotificationAsRead,
    markOrderDelivered: orderMocks.markOrderDelivered,
    notifyOrderPaid: orderMocks.notifyOrderPaid,
    updatePendingOrderLines: orderMocks.updatePendingOrderLines,
    verifyMobilePaymentP2c: orderMocks.verifyMobilePaymentP2c,
    verifyPaymentByAdmin: orderMocks.verifyPaymentByAdmin,
  };
});

const sampleOrder = {
  id: 'o1',
  status: 'pending',
  userId: 'u1',
  products: [],
  totalAmount: 0,
};

export function resetOrderServiceMocks(): void {
  orderMocks.ensurePendingCart.mockResolvedValue({ lines: [], order: { id: 'o1' } });
  orderMocks.getUserOrderHistory.mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
  orderMocks.getOrderByIdForUser.mockResolvedValue(sampleOrder);
  orderMocks.updatePendingOrderLines.mockResolvedValue({ lines: [], order: { id: 'o1' } });
  orderMocks.confirmPendingOrderPaymentWithDetails.mockResolvedValue({
    lines: [],
    order: { id: 'o1', status: 'paid' },
  });
  orderMocks.verifyMobilePaymentP2c.mockResolvedValue({ order: { id: 'o1', status: 'paid' } });
  orderMocks.listKitchenOrders.mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
  orderMocks.listDeliveryAvailable.mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
  orderMocks.listDeliveryMine.mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
  orderMocks.claimDeliveryOrder.mockResolvedValue({ ...sampleOrder, status: 'outForDelivery' });
  orderMocks.markOrderDelivered.mockResolvedValue({ ...sampleOrder, status: 'delivered' });
  orderMocks.getAnyOrderById.mockResolvedValue({ ...sampleOrder, status: 'outForDelivery' });
  orderMocks.adminSetOrderStatus.mockResolvedValue({ ...sampleOrder, status: 'preparing' });
  orderMocks.verifyPaymentByAdmin.mockResolvedValue({ ...sampleOrder, status: 'paid' });
  orderMocks.createOrderStatusNotification.mockResolvedValue(undefined);
  orderMocks.notifyOrderPaid.mockResolvedValue(undefined);
  orderMocks.listNotificationsForUser.mockResolvedValue({
    data: [],
    page: 1,
    pageSize: 20,
    total: 0,
  });
  orderMocks.markNotificationAsRead.mockResolvedValue(undefined);
  orderMocks.markAllNotificationsAsRead.mockResolvedValue(0);
}

export function getOrderMocks() {
  return orderMocks;
}

export function getEnsurePendingCartMock() {
  return orderMocks.ensurePendingCart;
}
