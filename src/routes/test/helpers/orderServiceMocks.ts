import { vi } from 'vitest';

const orderMocks = vi.hoisted(() => ({
  ensurePendingCart: vi.fn(),
  listDeliveryAvailable: vi.fn(),
  listKitchenOrders: vi.fn(),
}));

vi.mock('../../../services/orderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/orderService.js')>();
  return {
    ...actual,
    ensurePendingCart: orderMocks.ensurePendingCart,
    listDeliveryAvailable: orderMocks.listDeliveryAvailable,
    listKitchenOrders: orderMocks.listKitchenOrders,
  };
});

export function resetOrderServiceMocks(): void {
  orderMocks.ensurePendingCart.mockResolvedValue({ order: { id: 'o1' }, lines: [] });
  orderMocks.listKitchenOrders.mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
  orderMocks.listDeliveryAvailable.mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
}

export function getEnsurePendingCartMock() {
  return orderMocks.ensurePendingCart;
}
