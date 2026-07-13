import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMocks = vi.hoisted(() => ({
  order: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  payment: {
    update: vi.fn(),
    upsert: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  productStore: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  store: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const verifyP2cPayment = vi.hoisted(() => vi.fn());

vi.mock('../../realtime/socket.js', () => ({
  emitKitchenNewPaid: vi.fn(),
  emitOrderUpdated: vi.fn(),
  emitUserNotification: vi.fn(),
}));

vi.mock('../../config/megasoft.js', () => ({
  megasoftConfig: {
    amountOverride: null,
    certHardcoded: false,
    enabled: true,
  },
  resolveMegasoftAmount: (amount: number) => amount,
}));

vi.mock('../megasoft/index.js', () => ({
  isMegasoftP2cApproved: () => true,
  megasoftQueryP2cStatus: vi.fn(),
  verifyP2cPayment: (...args: unknown[]) => verifyP2cPayment(...args),
}));

vi.mock('../../prisma.js', () => ({
  default: {
    $transaction: vi.fn(async (cb: (tx: typeof txMocks) => unknown) => cb(txMocks)),
    notification: {
      count: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    product: { findMany: vi.fn() },
  },
}));

import {
  adminSetOrderStatus,
  claimDeliveryOrder,
  confirmPendingOrderPayment,
  confirmPendingOrderPaymentWithDetails,
  ensurePendingCart,
  getOrderByIdForUser,
  getUserOrderHistory,
  listDeliveryAvailable,
  listDeliveryMine,
  buildKitchenOrdersWhere,
  listKitchenOrders,
  listNotificationsForInbox,
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markOrderDelivered,
  notifyOrderPaid,
  OrderDomainError,
  updatePendingOrderLines,
  verifyMobilePaymentP2c,
  verifyPaymentByAdmin,
} from '../orderService.js';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date(),
    deliveryUserId: null,
    id: 'o1',
    paidAt: null,
    paymentDate: null,
    paymentMethod: null,
    paymentReference: null,
    paymentScreenshotUrl: null,
    products: [],
    status: 'pending',
    storeId: null,
    totalAmount: new Prisma.Decimal(10),
    updatedAt: new Date(),
    userId: 'u1',
    version: 1,
    ...overrides,
  };
}

function makeProduct() {
  return {
    active: true,
    code: 'SKU1',
    description: null,
    id: 'p1',
    imageUrl: null,
    name: 'Product 1',
  };
}

function setupEmptyCatalog(): void {
  txMocks.store.findMany.mockResolvedValue([]);
  txMocks.product.findMany.mockResolvedValue([]);
  txMocks.productStore.findMany.mockResolvedValue([]);
}

function setupProductLine(): void {
  txMocks.store.findMany.mockResolvedValue([]);
  txMocks.product.findMany.mockResolvedValue([makeProduct()]);
  txMocks.productStore.findMany.mockResolvedValue([]);
}

function seedProductWithStock(
  code: string,
  qty: number,
  price: number,
  storeId?: string,
): ReturnType<typeof makeProduct> {
  const product = { ...makeProduct(), code };
  if (storeId) {
    txMocks.store.findMany.mockResolvedValue([{ id: storeId }]);
    txMocks.store.findUnique.mockResolvedValue({ id: storeId, name: 'Store 1' });
    txMocks.product.findMany.mockResolvedValue([product]);
    txMocks.productStore.findMany.mockResolvedValue([
      {
        price: new Prisma.Decimal(price),
        productId: product.id,
        stockQuantity: qty,
        storeId,
      },
    ]);
  } else {
    txMocks.store.findMany.mockResolvedValue([]);
    txMocks.product.findMany.mockResolvedValue([product]);
    txMocks.productStore.findMany.mockResolvedValue([]);
  }
  return product;
}

function makePaidLine(overrides: Record<string, unknown> = {}) {
  return {
    code: 'SKU1',
    description: null,
    lineTotal: 10,
    name: 'Product 1',
    quantity: 1,
    unitPrice: 10,
    ...overrides,
  };
}

describe('orderService async flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyCatalog();
    txMocks.order.update.mockImplementation(async ({ data, where }) => {
      const existing = (await txMocks.order.findUnique({ where: { id: where.id } })) as ReturnType<
        typeof makeOrder
      > | null;
      const base = existing ?? makeOrder({ id: where.id });
      return {
        ...base,
        ...data,
        products: data.products ?? base.products,
        totalAmount: data.totalAmount ?? base.totalAmount,
      };
    });
    txMocks.order.updateMany.mockResolvedValue({ count: 1 });
    txMocks.payment.update.mockResolvedValue({});
    txMocks.payment.upsert.mockResolvedValue({});
    txMocks.productStore.updateMany.mockResolvedValue({ count: 1 });
    txMocks.product.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('ensurePendingCart', () => {
    it('creates a new pending cart when none exists', async () => {
      txMocks.order.findFirst.mockResolvedValue(null);
      txMocks.order.create.mockResolvedValue(makeOrder({ id: 'new-cart' }));

      const result = await ensurePendingCart('u1');

      expect(txMocks.order.create).toHaveBeenCalled();
      expect(result.order.id).toBe('new-cart');
      expect(result.order.status).toBe('pending');
    });

    it('reuses existing pending cart', async () => {
      txMocks.order.findFirst.mockResolvedValue(makeOrder({ id: 'existing-cart' }));

      const result = await ensurePendingCart('u1');

      expect(txMocks.order.create).not.toHaveBeenCalled();
      expect(result.order.id).toBe('existing-cart');
    });
  });

  describe('updatePendingOrderLines', () => {
    it('throws ORDER_NOT_FOUND when order does not belong to user', async () => {
      txMocks.order.findUnique.mockResolvedValue(null);

      await expect(
        updatePendingOrderLines('u1', 'missing', [{ code: 'SKU1', quantity: 1 }]),
      ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
    });

    it('throws ORDER_NOT_PENDING when order is not pending', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'paymentConfirmed' }));

      await expect(
        updatePendingOrderLines('u1', 'o1', [{ code: 'SKU1', quantity: 1 }]),
      ).rejects.toMatchObject({ code: 'ORDER_NOT_PENDING', statusCode: 409 });
    });

    it('updates lines for a pending order', async () => {
      setupProductLine();
      txMocks.order.findUnique.mockResolvedValue(makeOrder());
      txMocks.order.update.mockResolvedValue(
        makeOrder({
          products: [
            {
              code: 'SKU1',
              description: null,
              lineTotal: 0,
              name: 'Product 1',
              quantity: 2,
              unitPrice: 0,
            },
          ],
          totalAmount: new Prisma.Decimal(0),
        }),
      );

      const result = await updatePendingOrderLines('u1', 'o1', [{ code: 'SKU1', quantity: 2 }]);

      expect(result.order.products).toHaveLength(1);
      expect(result.order.products[0].code).toBe('SKU1');
    });
  });

  describe('confirmPendingOrderPaymentWithDetails', () => {
    it('throws ORDER_NOT_FOUND for unknown order', async () => {
      txMocks.order.findUnique.mockResolvedValue(null);

      await expect(
        confirmPendingOrderPaymentWithDetails('u1', 'missing', { method: 'cash' }),
      ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
    });

    it('confirms cash payment and updates order status', async () => {
      setupProductLine();
      const pending = makeOrder({
        products: [
          {
            code: 'SKU1',
            description: null,
            lineTotal: 10,
            name: 'Product 1',
            quantity: 1,
            unitPrice: 10,
          },
        ],
        totalAmount: new Prisma.Decimal(10),
      });
      txMocks.order.findUnique
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce({ ...pending, status: 'paymentConfirmed' });
      txMocks.order.update.mockImplementation(async ({ data }) => ({
        ...pending,
        ...data,
        status: data.status ?? pending.status,
      }));

      const result = await confirmPendingOrderPaymentWithDetails('u1', 'o1', {
        method: 'cash',
      });

      expect(result.order.status).toBe('paymentConfirmed');
      expect(txMocks.payment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('verifyMobilePaymentP2c', () => {
    it('throws INVALID_PAYMENT_AMOUNT when amount does not match order total', async () => {
      setupProductLine();
      const pending = makeOrder({
        products: [
          {
            code: 'SKU1',
            description: null,
            lineTotal: 10,
            name: 'Product 1',
            quantity: 1,
            unitPrice: 10,
          },
        ],
        totalAmount: new Prisma.Decimal(10),
      });
      txMocks.order.findUnique.mockResolvedValue(pending);
      txMocks.order.update.mockResolvedValue(pending);

      await expect(
        verifyMobilePaymentP2c('u1', 'o1', {
          amount: 99,
          clientBankCode: '0105',
          clientPhone: '04141234567',
          nationalId: 'V12345678',
          reference: 'REF1',
        }),
      ).rejects.toMatchObject({ code: 'INVALID_PAYMENT_AMOUNT', statusCode: 400 });

      expect(verifyP2cPayment).not.toHaveBeenCalled();
    });

    it('returns voucher on successful P2C verification', async () => {
      setupProductLine();
      const pending = makeOrder({
        products: [
          {
            code: 'SKU1',
            description: null,
            lineTotal: 10,
            name: 'Product 1',
            quantity: 1,
            unitPrice: 10,
          },
        ],
        totalAmount: new Prisma.Decimal(10),
      });
      txMocks.order.findUnique
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce({ ...pending, status: 'paymentConfirmed' });
      txMocks.order.update.mockResolvedValue(pending);
      verifyP2cPayment.mockResolvedValue({
        control: 'CTRL1',
        rawXml: '<xml/>',
        status: 'A',
        voucher: 'PAGO OK',
      });

      const result = await verifyMobilePaymentP2c('u1', 'o1', {
        amount: 10,
        clientBankCode: '0105',
        clientPhone: '04141234567',
        nationalId: 'V12345678',
        reference: 'REF1',
      });

      expect(result.voucher).toBe('PAGO OK');
      expect(verifyP2cPayment).toHaveBeenCalled();
    });
  });

  describe('verifyPaymentByAdmin', () => {
    it('confirms pending payment when verify is true', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder());
      txMocks.order.update.mockResolvedValue(makeOrder({ status: 'paymentConfirmed' }));

      const result = await verifyPaymentByAdmin('o1', 'admin-1', true);

      expect(result.status).toBe('paymentConfirmed');
      expect(txMocks.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verifiedBy: 'admin-1' }),
        }),
      );
    });

    it('clears verification when verify is false', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder());

      const result = await verifyPaymentByAdmin('o1', 'admin-1', false);

      expect(result.status).toBe('pending');
      expect(txMocks.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { verifiedAt: null, verifiedBy: null },
        }),
      );
    });
  });

  describe('adminSetOrderStatus', () => {
    it('allows pending to paymentConfirmed', async () => {
      txMocks.order.findUnique
        .mockResolvedValueOnce(makeOrder({ status: 'pending' }))
        .mockResolvedValueOnce(makeOrder({ status: 'paymentConfirmed' }));

      const result = await adminSetOrderStatus('o1', 'paymentConfirmed');

      expect(result.status).toBe('paymentConfirmed');
    });

    it('throws INVALID_STATUS_TRANSITION for invalid transition', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'pending' }));

      await expect(adminSetOrderStatus('o1', 'delivered')).rejects.toBeInstanceOf(OrderDomainError);
    });
  });

  describe('getOrderByIdForUser', () => {
    it('returns non-pending order without reconciliation', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'paymentConfirmed' }));

      const result = await getOrderByIdForUser('u1', 'o1');

      expect(result.order.status).toBe('paymentConfirmed');
      expect(result.changes).toEqual([]);
    });
  });

  describe('getUserOrderHistory', () => {
    it('returns paginated non-pending orders', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        { ...makeOrder({ status: 'delivered' }), store: { name: 'Store 1' } },
      ]);
      vi.mocked(prisma.order.count).mockResolvedValue(1);
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);

      const result = await getUserOrderHistory('u1', 1, 10);

      expect(result.total).toBe(1);
      expect(result.data[0].status).toBe('delivered');
    });
  });

  describe('delivery listings', () => {
    it('listDeliveryAvailable returns ready orders', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        makeOrder({ status: 'readyForDelivery' }),
      ]);
      vi.mocked(prisma.order.count).mockResolvedValue(1);

      const result = await listDeliveryAvailable(1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].status).toBe('readyForDelivery');
    });

    it('listDeliveryMine returns driver orders', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        makeOrder({ deliveryUserId: 'driver-1', status: 'outForDelivery' }),
      ]);
      vi.mocked(prisma.order.count).mockResolvedValue(1);

      const result = await listDeliveryMine('driver-1', 1, 10);
      expect(result.data[0].status).toBe('outForDelivery');
    });
  });

  describe('claimDeliveryOrder', () => {
    it('claims ready order for delivery driver', async () => {
      txMocks.order.updateMany.mockResolvedValue({ count: 1 });
      txMocks.order.findUnique.mockResolvedValue(
        makeOrder({ deliveryUserId: 'driver-1', status: 'outForDelivery' }),
      );

      const result = await claimDeliveryOrder('o1', 'driver-1');
      expect(result.status).toBe('outForDelivery');
    });

    it('throws ORDER_NOT_AVAILABLE when claim fails', async () => {
      txMocks.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(claimDeliveryOrder('o1', 'driver-1')).rejects.toMatchObject({
        code: 'ORDER_NOT_AVAILABLE',
        statusCode: 409,
      });
    });
  });

  describe('markOrderDelivered', () => {
    it('marks order delivered for delivery driver', async () => {
      txMocks.order.updateMany.mockResolvedValue({ count: 1 });
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'delivered' }));

      const result = await markOrderDelivered('deliveryDriver', 'o1', 'driver-1');
      expect(result.status).toBe('delivered');
    });
  });

  describe('confirmPendingOrderPayment', () => {
    it('returns existing order when already paymentConfirmed', async () => {
      const paid = makeOrder({
        products: [
          {
            code: 'SKU1',
            description: null,
            lineTotal: 10,
            name: 'Product 1',
            quantity: 1,
            unitPrice: 10,
          },
        ],
        status: 'paymentConfirmed',
        totalAmount: new Prisma.Decimal(10),
      });
      txMocks.order.findUnique.mockResolvedValue(paid);

      const result = await confirmPendingOrderPayment('u1', 'o1');

      expect(result.justConfirmed).toBe(false);
      expect(result.order.status).toBe('paymentConfirmed');
    });

    it('reports missing product as inventory change via update lines', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder());
      txMocks.product.findMany.mockResolvedValue([]);
      txMocks.order.update.mockResolvedValue(makeOrder({ products: [] }));

      const result = await updatePendingOrderLines('u1', 'o1', [{ code: 'MISSING', quantity: 2 }]);
      expect(result.changes).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'MISSING', reason: 'missing' })]),
      );
      expect(result.order.products).toEqual([]);
    });

    it('confirms payment and decrements stock when inventory is available', async () => {
      seedProductWithStock('SKU1', 5, 10, 'store-1');
      const pending = makeOrder({
        products: [makePaidLine()],
        storeId: 'store-1',
        totalAmount: new Prisma.Decimal(10),
      });
      txMocks.order.findUnique
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce({ ...pending, status: 'paymentConfirmed' });
      txMocks.productStore.updateMany.mockResolvedValue({ count: 1 });

      const result = await confirmPendingOrderPayment('u1', 'o1');

      expect(result.justConfirmed).toBe(true);
      expect(result.order.status).toBe('paymentConfirmed');
      expect(txMocks.productStore.updateMany).toHaveBeenCalled();
    });

    it('throws ORDER_EMPTY_AFTER_ADJUSTMENT when all products are out of stock', async () => {
      seedProductWithStock('SKU1', 0, 10, 'store-1');
      const pending = makeOrder({
        products: [makePaidLine()],
        storeId: 'store-1',
        totalAmount: new Prisma.Decimal(10),
      });
      txMocks.order.findUnique.mockResolvedValue(pending);
      txMocks.order.update.mockResolvedValue(makeOrder({ products: [] }));

      await expect(confirmPendingOrderPayment('u1', 'o1')).rejects.toMatchObject({
        code: 'ORDER_EMPTY_AFTER_ADJUSTMENT',
        statusCode: 409,
      });
    });

    it('throws ORDER_INVENTORY_CHANGED when stock depletes during confirmation', async () => {
      seedProductWithStock('SKU1', 5, 10, 'store-1');
      const pending = makeOrder({
        products: [makePaidLine()],
        storeId: 'store-1',
        totalAmount: new Prisma.Decimal(10),
      });
      txMocks.order.findUnique.mockResolvedValue(pending);
      txMocks.productStore.updateMany.mockResolvedValue({ count: 0 });

      await expect(confirmPendingOrderPayment('u1', 'o1')).rejects.toMatchObject({
        code: 'ORDER_INVENTORY_CHANGED',
        statusCode: 409,
      });
    });
  });

  describe('applyStoreIdToPendingOrder via updatePendingOrderLines', () => {
    it('throws STORE_NOT_FOUND for unknown store', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder());
      txMocks.store.findUnique.mockResolvedValue(null);

      await expect(
        updatePendingOrderLines('u1', 'o1', [{ code: 'SKU1', quantity: 1 }], 'unknown-store'),
      ).rejects.toMatchObject({ code: 'STORE_NOT_FOUND', statusCode: 400 });
    });

    it('throws STORE_MISMATCH when order belongs to another store', async () => {
      setupProductLine();
      txMocks.order.findUnique.mockResolvedValue(
        makeOrder({
          products: [makePaidLine()],
          storeId: 'store-a',
        }),
      );
      txMocks.store.findUnique.mockResolvedValue({ id: 'store-b', name: 'Other' });

      await expect(
        updatePendingOrderLines('u1', 'o1', [{ code: 'SKU1', quantity: 1 }], 'store-b'),
      ).rejects.toMatchObject({ code: 'STORE_MISMATCH', statusCode: 409 });
    });
  });

  describe('getOrderByIdForUser pending reconciliation', () => {
    it('adjusts quantities when stock is limited', async () => {
      seedProductWithStock('SKU1', 1, 10, 'store-1');
      txMocks.order.findUnique.mockResolvedValue(
        makeOrder({
          storeId: 'store-1',
          products: [makePaidLine({ quantity: 5 })],
        }),
      );
      txMocks.order.update.mockResolvedValue(
        makeOrder({
          products: [makePaidLine({ quantity: 1, lineTotal: 10, unitPrice: 10 })],
        }),
      );

      const result = await getOrderByIdForUser('u1', 'o1');

      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'SKU1', reason: 'quantity_adjusted' }),
        ]),
      );
      expect(result.order.products[0].quantity).toBe(1);
    });
  });

  describe('listKitchenOrders', () => {
    it('returns paginated kitchen orders with enriched images', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          ...makeOrder({ status: 'paymentConfirmed' }),
          payment: null,
          store: { name: 'Store 1' },
          user: { numberId: 'V123' },
          products: [
            {
              code: 'SKU1',
              imageUrl: null,
              name: 'P',
              quantity: 1,
              unitPrice: 1,
              lineTotal: 1,
              description: null,
            },
          ],
        },
      ] as never);
      vi.mocked(prisma.order.count).mockResolvedValue(1);
      vi.mocked(prisma.product.findMany).mockResolvedValue([
        { code: 'SKU1', imageUrl: 'https://img/sku1.jpg' },
      ]);

      const result = await listKitchenOrders(1, 10, 'admin');

      expect(result.total).toBe(1);
      expect(result.data[0].storeName).toBe('Store 1');
      expect(result.data[0].userNumberId).toBe('V123');
    });
  });

  describe('buildKitchenOrdersWhere', () => {
    it('excludes pending and cancelled when status is all', () => {
      expect(buildKitchenOrdersWhere({ status: 'all' })).toEqual({
        status: { notIn: ['pending', 'cancelled'] },
      });
    });

    it('filters by case-sensitive id contains', () => {
      expect(buildKitchenOrdersWhere({ id: 'ABC' })).toEqual({
        id: { contains: 'ABC' },
        status: { notIn: ['pending', 'cancelled'] },
      });
    });

    it('filters by storeId and exact status', () => {
      expect(
        buildKitchenOrdersWhere({
          status: 'preparing',
          storeId: 'store-1',
        }),
      ).toEqual({
        status: 'preparing',
        storeId: 'store-1',
      });
    });

    it('filters by createdAt range with start and end of day', () => {
      const createdFrom = new Date(2026, 6, 1, 15, 30);
      const createdTo = new Date(2026, 6, 13, 8, 0);
      const where = buildKitchenOrdersWhere({ createdFrom, createdTo });

      expect(where.createdAt?.gte).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
      expect(where.createdAt?.lte).toEqual(new Date(2026, 6, 13, 23, 59, 59, 999));
      expect(where.status).toEqual({ notIn: ['pending', 'cancelled'] });
    });

    it('passes filters to prisma findMany', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);

      await listKitchenOrders(1, 10, 'admin', {
        id: 'order',
        status: 'readyForDelivery',
        storeId: 'store-2',
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { contains: 'order' },
            status: 'readyForDelivery',
            storeId: 'store-2',
          },
        }),
      );
    });
  });

  describe('notifications', () => {
    it('listNotificationsForUser returns paginated notifications', async () => {
      const prisma = (await import('../../prisma.js')).default;
      const notification = {
        id: 'n1',
        userId: 'u1',
        title: 'Test',
        body: 'Body',
        type: 'ORDER_STATUS_CHANGED',
        readAt: null,
        createdAt: new Date(),
        orderId: 'o1',
        payload: {},
      };
      vi.mocked(prisma.notification.findMany).mockResolvedValue([notification] as never);
      vi.mocked(prisma.notification.count).mockResolvedValue(1);

      const result = await listNotificationsForUser('u1', 1, 10);

      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('n1');
    });

    it('listNotificationsForInbox returns unread plus recent read notifications', async () => {
      const prisma = (await import('../../prisma.js')).default;
      const unread = {
        id: 'n-unread',
        userId: 'u1',
        title: 'Unread',
        body: 'Body',
        type: 'ORDER_STATUS_CHANGED',
        readAt: null,
        createdAt: new Date('2026-01-03T10:00:00Z'),
        orderId: 'o1',
        payload: {},
      };
      const read = {
        id: 'n-read',
        userId: 'u1',
        title: 'Read',
        body: 'Body',
        type: 'ORDER_STATUS_CHANGED',
        readAt: new Date('2026-01-02T10:00:00Z'),
        createdAt: new Date('2026-01-02T10:00:00Z'),
        orderId: 'o2',
        payload: {},
      };
      vi.mocked(prisma.notification.findMany)
        .mockResolvedValueOnce([unread] as never)
        .mockResolvedValueOnce([read] as never);
      vi.mocked(prisma.notification.count).mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      const result = await listNotificationsForInbox('u1', 5);

      expect(result.unreadCount).toBe(1);
      expect(result.total).toBe(2);
      expect(result.data.map((item) => item.id)).toEqual(['n-unread', 'n-read']);
    });

    it('listNotificationsForInbox returns only unread when recentRead is 0', async () => {
      const prisma = (await import('../../prisma.js')).default;
      const unread = {
        id: 'n-unread',
        userId: 'u1',
        title: 'Unread',
        body: 'Body',
        type: 'ORDER_STATUS_CHANGED',
        readAt: null,
        createdAt: new Date('2026-01-03T10:00:00Z'),
        orderId: 'o1',
        payload: {},
      };
      vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([unread] as never);
      vi.mocked(prisma.notification.count).mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      const result = await listNotificationsForInbox('u1', 0);

      expect(result.data).toHaveLength(1);
      expect(prisma.notification.findMany).toHaveBeenCalledTimes(1);
    });

    it('markNotificationAsRead throws NOTIFICATION_NOT_FOUND when missing', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 });

      await expect(markNotificationAsRead('u1', 'missing')).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('markAllNotificationsAsRead returns updated count', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 });

      const count = await markAllNotificationsAsRead('u1');
      expect(count).toBe(3);
    });
  });

  describe('notifyOrderPaid', () => {
    it('creates notification and emits socket events', async () => {
      const prisma = (await import('../../prisma.js')).default;
      const socket = await import('../../realtime/socket.js');
      const order = {
        id: 'o1',
        userId: 'u1',
        status: 'paymentConfirmed' as const,
        totalAmount: 10,
        products: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deliveryUserId: null,
        paidAt: null,
        paymentDate: null,
        paymentMethod: null,
        paymentReference: null,
        paymentScreenshotUrl: null,
        storeId: null,
        version: 1,
      };

      await notifyOrderPaid(order, 'pending');

      expect(prisma.notification.create).toHaveBeenCalled();
      expect(socket.emitUserNotification).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ type: 'ORDER_STATUS_CHANGED' }),
      );
      expect(socket.emitOrderUpdated).toHaveBeenCalled();
      expect(socket.emitKitchenNewPaid).toHaveBeenCalledWith(order);
    });
  });

  describe('getUserOrderHistory image enrichment', () => {
    it('fills missing imageUrl from product catalog', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          ...makeOrder({
            status: 'delivered',
            products: [
              {
                code: 'SKU1',
                description: null,
                imageUrl: null,
                lineTotal: 10,
                name: 'Product 1',
                quantity: 1,
                unitPrice: 10,
              },
            ],
          }),
          store: { name: 'Store 1' },
        },
      ] as never);
      vi.mocked(prisma.order.count).mockResolvedValue(1);
      vi.mocked(prisma.product.findMany).mockResolvedValue([
        { code: 'SKU1', imageUrl: 'https://cdn/img.jpg' },
      ]);

      const result = await getUserOrderHistory('u1', 1, 10);

      expect(result.data[0].products[0].imageUrl).toBe('https://cdn/img.jpg');
    });
  });

  describe('adminSetOrderStatus edge cases', () => {
    it('throws ORDER_NOT_CANCELLABLE for delivered order', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'delivered' }));

      await expect(adminSetOrderStatus('o1', 'cancelled')).rejects.toMatchObject({
        code: 'ORDER_NOT_CANCELLABLE',
        statusCode: 400,
      });
    });

    it('throws ORDER_CONFLICT on concurrent update', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'paymentConfirmed' }));
      txMocks.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(adminSetOrderStatus('o1', 'preparing')).rejects.toMatchObject({
        code: 'ORDER_CONFLICT',
        statusCode: 409,
      });
    });
  });

  describe('verifyMobilePaymentP2c extended', () => {
    it('upserts payment record on successful verification', async () => {
      seedProductWithStock('SKU1', 5, 10, 'store-1');
      const pending = makeOrder({
        products: [makePaidLine()],
        storeId: 'store-1',
        totalAmount: new Prisma.Decimal(10),
      });
      txMocks.order.findUnique
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce({ ...pending, status: 'paymentConfirmed' });
      txMocks.order.update.mockResolvedValue(pending);
      txMocks.productStore.updateMany.mockResolvedValue({ count: 1 });
      verifyP2cPayment.mockResolvedValue({
        control: 'CTRL1',
        rawXml: '<xml/>',
        status: 'A',
        voucher: 'PAGO OK',
      });

      await verifyMobilePaymentP2c('u1', 'o1', {
        amount: 10,
        clientBankCode: '0105',
        clientPhone: '04141234567',
        nationalId: 'V12345678',
        reference: 'REF1',
      });

      expect(txMocks.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ method: 'mobilePayment', reference: 'REF1' }),
        }),
      );
    });

    it('returns idempotently when order already paymentConfirmed in second transaction', async () => {
      seedProductWithStock('SKU1', 5, 10);
      const pending = makeOrder({
        products: [makePaidLine()],
        totalAmount: new Prisma.Decimal(10),
      });
      const paid = { ...pending, status: 'paymentConfirmed' };
      txMocks.order.findUnique
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(paid);
      txMocks.order.update.mockResolvedValue(pending);
      txMocks.productStore.updateMany.mockResolvedValue({ count: 1 });
      txMocks.order.updateMany.mockImplementation(async () => ({ count: 0 }));
      verifyP2cPayment.mockResolvedValue({
        control: 'CTRL1',
        rawXml: '<xml/>',
        status: 'A',
        voucher: 'PAGO OK',
      });

      const result = await verifyMobilePaymentP2c('u1', 'o1', {
        amount: 10,
        clientBankCode: '0105',
        clientPhone: '04141234567',
        nationalId: 'V12345678',
        reference: 'REF1',
      });

      expect(result.order.status).toBe('paymentConfirmed');
      expect(result.voucher).toBe('PAGO OK');
    });
  });

  describe('markOrderDelivered admin path', () => {
    it('marks order delivered when actor is admin', async () => {
      txMocks.order.updateMany.mockResolvedValue({ count: 1 });
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'delivered' }));

      const result = await markOrderDelivered('superAdmin', 'o1', 'admin-1');
      expect(result.status).toBe('delivered');
    });

    it('throws ORDER_NOT_IN_DELIVERY when update fails', async () => {
      txMocks.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(markOrderDelivered('deliveryDriver', 'o1', 'driver-1')).rejects.toMatchObject({
        code: 'ORDER_NOT_IN_DELIVERY',
        statusCode: 409,
      });
    });
  });
});
