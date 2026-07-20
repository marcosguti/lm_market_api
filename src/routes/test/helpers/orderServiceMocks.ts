import { vi } from 'vitest';

const orderMocks = vi.hoisted(() => ({
  adminSetOrderStatus: vi.fn(),
  assignOrderToDelivery: vi.fn(),
  confirmPendingOrderPaymentWithDetails: vi.fn(),
  createOrderStatusNotification: vi.fn(),
  ensurePendingCart: vi.fn(),
  getAnyOrderById: vi.fn(),
  getOrderByIdForUser: vi.fn(),
  getUserOrderHistory: vi.fn(),
  listDeliveryDriversForOrder: vi.fn(),
  listDeliveryMine: vi.fn(),
  listKitchenOrders: vi.fn(),
  listNotificationsForUser: vi.fn(),
  listOrderStatusHistory: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markOrderDelivered: vi.fn(),
  notifyDeliveryAssigned: vi.fn(),
  notifyDeliveryCancelled: vi.fn(),
  notifyOrderPaid: vi.fn(),
  notifyOrderStatusChange: vi.fn(),
  startOrderDelivering: vi.fn(),
  unassignOrderFromDelivery: vi.fn(),
  updatePendingOrderLines: vi.fn(),
  verifyMobilePaymentP2c: vi.fn(),
  verifyPaymentByAdmin: vi.fn(),
}));

vi.mock('../../../services/orderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/orderService.js')>();
  return {
    ...actual,
    adminSetOrderStatus: orderMocks.adminSetOrderStatus,
    assignOrderToDelivery: orderMocks.assignOrderToDelivery,
    confirmPendingOrderPaymentWithDetails: orderMocks.confirmPendingOrderPaymentWithDetails,
    createOrderStatusNotification: orderMocks.createOrderStatusNotification,
    ensurePendingCart: orderMocks.ensurePendingCart,
    getAnyOrderById: orderMocks.getAnyOrderById,
    getOrderByIdForUser: orderMocks.getOrderByIdForUser,
    getUserOrderHistory: orderMocks.getUserOrderHistory,
    listDeliveryDriversForOrder: orderMocks.listDeliveryDriversForOrder,
    listDeliveryMine: orderMocks.listDeliveryMine,
    listKitchenOrders: orderMocks.listKitchenOrders,
    listNotificationsForUser: orderMocks.listNotificationsForUser,
    listOrderStatusHistory: orderMocks.listOrderStatusHistory,
    markAllNotificationsAsRead: orderMocks.markAllNotificationsAsRead,
    markNotificationAsRead: orderMocks.markNotificationAsRead,
    markOrderDelivered: orderMocks.markOrderDelivered,
    notifyDeliveryAssigned: orderMocks.notifyDeliveryAssigned,
    notifyDeliveryCancelled: orderMocks.notifyDeliveryCancelled,
    notifyOrderPaid: orderMocks.notifyOrderPaid,
    notifyOrderStatusChange: orderMocks.notifyOrderStatusChange,
    startOrderDelivering: orderMocks.startOrderDelivering,
    unassignOrderFromDelivery: orderMocks.unassignOrderFromDelivery,
    updatePendingOrderLines: orderMocks.updatePendingOrderLines,
    verifyMobilePaymentP2c: orderMocks.verifyMobilePaymentP2c,
    verifyPaymentByAdmin: orderMocks.verifyPaymentByAdmin,
  };
});

vi.mock('../../../libs/filesInDigitalOcean/index.js', () => ({
  uploadBannerImage: vi.fn().mockResolvedValue('https://cdn/banner.jpg'),
  uploadDealImage: vi.fn().mockResolvedValue('https://cdn/deal.jpg'),
  uploadDeliveryProof: vi.fn().mockResolvedValue('https://cdn/delivery/proof.jpg'),
  uploadFile: vi.fn().mockResolvedValue('https://cdn/file.jpg'),
  uploadPaymentScreenshot: vi.fn().mockResolvedValue('https://cdn/payment.jpg'),
}));

const sampleOrder = {
  id: 'o1',
  status: 'pending',
  storeId: 'store-1',
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
  orderMocks.listDeliveryDriversForOrder.mockResolvedValue([]);
  orderMocks.listDeliveryMine.mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
  orderMocks.assignOrderToDelivery.mockResolvedValue({
    ...sampleOrder,
    status: 'assignedToDeliveryDriver',
  });
  orderMocks.unassignOrderFromDelivery.mockResolvedValue({
    ...sampleOrder,
    status: 'readyForDelivery',
  });
  orderMocks.startOrderDelivering.mockResolvedValue({ ...sampleOrder, status: 'delivering' });
  orderMocks.markOrderDelivered.mockResolvedValue({ ...sampleOrder, status: 'delivered' });
  orderMocks.getAnyOrderById.mockResolvedValue({ ...sampleOrder, status: 'delivering' });
  orderMocks.adminSetOrderStatus.mockResolvedValue({ ...sampleOrder, status: 'preparing' });
  orderMocks.verifyPaymentByAdmin.mockResolvedValue({ ...sampleOrder, status: 'paid' });
  orderMocks.listOrderStatusHistory.mockResolvedValue([]);
  orderMocks.createOrderStatusNotification.mockResolvedValue(undefined);
  orderMocks.notifyOrderStatusChange.mockResolvedValue(undefined);
  orderMocks.notifyDeliveryAssigned.mockResolvedValue(undefined);
  orderMocks.notifyDeliveryCancelled.mockResolvedValue(undefined);
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
