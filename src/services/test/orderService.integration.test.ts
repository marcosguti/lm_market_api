import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMocks = vi.hoisted(() => ({
  order: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  orderStatusHistory: {
    create: vi.fn(),
  },
  payment: {
    update: vi.fn(),
    upsert: vi.fn(),
  },
  paymentMethodConfig: {
    findUnique: vi.fn(),
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
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
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
  resolveMegasoftAmount: async (amount: number) => amount,
}));

vi.mock('../bcvExchangeRate.js', () => ({
  getUsdVesRate: vi.fn().mockResolvedValue(600),
}));

vi.mock('../megasoft/index.js', () => ({
  isMegasoftP2cApproved: () => true,
  megasoftQueryP2cStatus: vi.fn(),
  verifyP2cPayment: (...args: unknown[]) => verifyP2cPayment(...args),
}));

vi.mock('../../prisma.js', () => ({
  default: {
    $transaction: vi.fn(async (cb: (tx: typeof txMocks) => unknown) => cb(txMocks)),
    exchangeRate: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
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
    orderStatusHistory: {
      findMany: vi.fn(),
    },
    paymentMethodConfig: {
      findUnique: (...args: unknown[]) => txMocks.paymentMethodConfig.findUnique(...args),
    },
    product: { findMany: vi.fn() },
  },
}));

import {
  adminSetOrderStatus,
  assignOrderToDelivery,
  confirmPendingOrderPayment,
  confirmPendingOrderPaymentWithDetails,
  ensurePendingCart,
  getOrderByIdForUser,
  getUserOrderHistory,
  listDeliveryMine,
  listOrderStatusHistory,
  buildKitchenOrdersWhere,
  listKitchenOrders,
  listNotificationsForInbox,
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markOrderDelivered,
  notifyOrderPaid,
  OrderDomainError,
  startOrderDelivering,
  unassignOrderFromDelivery,
  updatePendingOrderLines,
  verifyMobilePaymentP2c,
  verifyPaymentByAdmin,
} from '../orderService.js';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date(),
    deliveryUserId: null,
    exchangeRate: null,
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
    txMocks.store.findUnique.mockResolvedValue({
      city: 'merida',
      id: storeId,
      name: 'Store 1',
    });
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
    txMocks.order.count.mockResolvedValue(0);
    txMocks.orderStatusHistory.create.mockResolvedValue({});
    txMocks.payment.update.mockResolvedValue({});
    txMocks.payment.upsert.mockResolvedValue({});
    txMocks.paymentMethodConfig.findUnique.mockResolvedValue({
      active: true,
      information: null,
      method: 'cash',
      noteEnabled: true,
      placeholder: 'Toma una foto legible del billete',
      updatedAt: new Date(),
    });
    txMocks.productStore.updateMany.mockResolvedValue({ count: 1 });
    txMocks.product.updateMany.mockResolvedValue({ count: 1 });
    txMocks.user.findUnique.mockResolvedValue({
      address: 'Calle Falsa 123',
      addressCity: 'merida',
      addressLatitude: new Prisma.Decimal('8.5897000'),
      addressLongitude: new Prisma.Decimal('-71.1561000'),
      phone: '04141234567',
      type: 'client',
    });
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

    it('confirms cash payment to paymentPendingConfirmation with payment record', async () => {
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
      const submitted = {
        ...pending,
        paymentScreenshotUrl: 'https://cdn/proof.jpg',
        status: 'paymentPendingConfirmation',
      };
      txMocks.order.findUnique.mockResolvedValueOnce(pending).mockResolvedValue(submitted);
      txMocks.order.update.mockImplementation(async ({ data }) => ({
        ...pending,
        ...data,
        status: data.status ?? pending.status,
      }));

      const result = await confirmPendingOrderPaymentWithDetails('u1', 'o1', {
        method: 'cash',
        screenshotUrl: 'https://cdn/proof.jpg',
      });

      expect(result.order.status).toBe('paymentPendingConfirmation');
      expect(txMocks.payment.upsert).toHaveBeenCalled();
      expect(txMocks.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryAddress: 'Calle Falsa 123',
            status: 'paymentPendingConfirmation',
          }),
        }),
      );
      expect(txMocks.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'pending',
            toStatus: 'paymentPendingConfirmation',
          }),
        }),
      );
    });

    it('throws ADDRESS_REQUIRED when profile has no delivery pin', async () => {
      setupProductLine();
      txMocks.user.findUnique.mockResolvedValue({
        address: null,
        addressCity: null,
        addressLatitude: null,
        addressLongitude: null,
        phone: '04141234567',
        type: 'client',
      });
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
      });
      txMocks.order.findUnique.mockResolvedValue(pending);
      txMocks.order.update.mockResolvedValue(pending);
      txMocks.product.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        confirmPendingOrderPaymentWithDetails('u1', 'o1', {
          method: 'cash',
          screenshotUrl: 'https://cdn/proof.jpg',
        }),
      ).rejects.toMatchObject({ code: 'ADDRESS_REQUIRED', statusCode: 409 });
    });

    it('throws ADDRESS_CITY_MISMATCH when profile city differs from store', async () => {
      setupProductLine();
      txMocks.user.findUnique.mockResolvedValue({
        address: 'Centro Tovar',
        addressCity: 'tovar',
        addressLatitude: new Prisma.Decimal('8.3305000'),
        addressLongitude: new Prisma.Decimal('-71.7575000'),
        phone: '04141234567',
        type: 'client',
      });
      txMocks.store.findUnique.mockResolvedValue({
        city: 'merida',
        id: 'store-1',
        name: 'Las Americas',
      });
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
        storeId: 'store-1',
      });
      txMocks.order.findUnique.mockResolvedValue(pending);
      txMocks.order.update.mockResolvedValue(pending);
      txMocks.productStore.findMany.mockResolvedValue([
        {
          price: new Prisma.Decimal(10),
          productId: 'p1',
          stockQuantity: 5,
          storeId: 'store-1',
        },
      ]);
      txMocks.productStore.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        confirmPendingOrderPaymentWithDetails('u1', 'o1', {
          method: 'cash',
          screenshotUrl: 'https://cdn/proof.jpg',
        }),
      ).rejects.toMatchObject({ code: 'ADDRESS_CITY_MISMATCH', statusCode: 409 });
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
    it('confirms paymentPendingConfirmation when verify is true', async () => {
      txMocks.order.findUnique.mockResolvedValue(
        makeOrder({ status: 'paymentPendingConfirmation' }),
      );
      txMocks.order.update.mockResolvedValue(makeOrder({ status: 'paymentConfirmed' }));

      const result = await verifyPaymentByAdmin('o1', 'admin-1', true);

      expect(result.status).toBe('paymentConfirmed');
      expect(txMocks.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verifiedBy: 'admin-1' }),
        }),
      );
      expect(txMocks.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'paymentPendingConfirmation',
            toStatus: 'paymentConfirmed',
          }),
        }),
      );
    });

    it('rejects verify when order is still pending', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'pending' }));

      await expect(verifyPaymentByAdmin('o1', 'admin-1', true)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
        statusCode: 400,
      });
    });

    it('clears verification when verify is false', async () => {
      txMocks.order.findUnique.mockResolvedValue(
        makeOrder({ status: 'paymentPendingConfirmation' }),
      );

      const result = await verifyPaymentByAdmin('o1', 'admin-1', false);

      expect(result.status).toBe('paymentPendingConfirmation');
      expect(txMocks.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { verifiedAt: null, verifiedBy: null },
        }),
      );
    });
  });

  describe('adminSetOrderStatus', () => {
    it('rejects pending to paymentConfirmed (use verify-payment)', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'pending' }));

      await expect(adminSetOrderStatus('o1', 'paymentConfirmed', 'admin-1')).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });

    it('throws INVALID_STATUS_TRANSITION for invalid transition', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'pending' }));

      await expect(adminSetOrderStatus('o1', 'delivered', 'admin-1')).rejects.toBeInstanceOf(
        OrderDomainError,
      );
    });

    it('persists cancellationReason when cancelling', async () => {
      txMocks.order.findUnique
        .mockResolvedValueOnce(makeOrder({ status: 'preparing' }))
        .mockResolvedValueOnce(makeOrder({ cancellationReason: 'Sin stock', status: 'cancelled' }));

      const result = await adminSetOrderStatus('o1', 'cancelled', 'admin-1', 'Sin stock');

      expect(result.status).toBe('cancelled');
      expect(txMocks.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancellationReason: 'Sin stock',
            status: 'cancelled',
          }),
        }),
      );
    });

    it('requires cancellationReason when cancelling', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'preparing' }));

      await expect(adminSetOrderStatus('o1', 'cancelled', 'admin-1')).rejects.toMatchObject({
        code: 'CANCELLATION_REASON_REQUIRED',
        statusCode: 400,
      });
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
    it('listDeliveryMine returns assigned and delivering orders', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          ...makeOrder({ deliveryUserId: 'driver-1', status: 'assignedToDeliveryDriver' }),
          user: { address: 'Av. Principal', phone: '04140001122' },
        },
      ] as never);
      vi.mocked(prisma.order.count).mockResolvedValue(1);

      const result = await listDeliveryMine('driver-1', 1, 10);
      expect(result.data[0].status).toBe('assignedToDeliveryDriver');
      expect(result.data[0].deliveryAddress).toBe('Av. Principal');
      expect(result.data[0].deliveryPhone).toBe('04140001122');
    });

    it('listDeliveryMine prefers order delivery fields over user profile', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          ...makeOrder({
            deliveryAddress: 'Direccion pedido',
            deliveryPhone: '04241234567',
            deliveryUserId: 'driver-1',
            status: 'delivering',
          }),
          user: { address: 'Perfil', phone: '04140001122' },
        },
      ] as never);
      vi.mocked(prisma.order.count).mockResolvedValue(1);

      const result = await listDeliveryMine('driver-1', 1, 10);
      expect(result.data[0].deliveryAddress).toBe('Direccion pedido');
      expect(result.data[0].deliveryPhone).toBe('04241234567');
    });
  });

  describe('listOrderStatusHistory', () => {
    it('includes deliveryProofUrl only on delivered entries', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        makeOrder({
          deliveryProofUrl: 'https://cdn/proof.jpg',
          status: 'delivered',
        }),
      );
      vi.mocked(prisma.orderStatusHistory.findMany).mockResolvedValue([
        {
          changedBy: {
            email: 'a@test.com',
            firstName: 'Ana',
            id: 'u1',
            lastName: 'Admin',
            type: 'admin',
          },
          createdAt: new Date('2026-07-15T12:00:00.000Z'),
          fromStatus: 'delivering',
          id: 'h1',
          toStatus: 'delivered',
        },
        {
          changedBy: {
            email: 'a@test.com',
            firstName: 'Ana',
            id: 'u1',
            lastName: 'Admin',
            type: 'admin',
          },
          createdAt: new Date('2026-07-15T11:00:00.000Z'),
          fromStatus: 'readyForDelivery',
          id: 'h0',
          toStatus: 'assignedToDeliveryDriver',
        },
      ] as never);

      const result = await listOrderStatusHistory('o1');
      expect(result[0].deliveryProofUrl).toBe('https://cdn/proof.jpg');
      expect(result[0].cancellationReason).toBeNull();
      expect(result[1].deliveryProofUrl).toBeNull();
    });

    it('includes cancellationReason only on cancelled entries', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        makeOrder({
          cancellationReason: 'Cliente no responde',
          status: 'cancelled',
        }),
      );
      vi.mocked(prisma.orderStatusHistory.findMany).mockResolvedValue([
        {
          changedBy: {
            email: 'a@test.com',
            firstName: 'Ana',
            id: 'u1',
            lastName: 'Admin',
            type: 'admin',
          },
          createdAt: new Date('2026-07-15T12:00:00.000Z'),
          fromStatus: 'preparing',
          id: 'h1',
          toStatus: 'cancelled',
        },
        {
          changedBy: {
            email: 'a@test.com',
            firstName: 'Ana',
            id: 'u1',
            lastName: 'Admin',
            type: 'admin',
          },
          createdAt: new Date('2026-07-15T11:00:00.000Z'),
          fromStatus: 'paymentConfirmed',
          id: 'h0',
          toStatus: 'preparing',
        },
      ] as never);

      const result = await listOrderStatusHistory('o1');
      expect(result[0].cancellationReason).toBe('Cliente no responde');
      expect(result[1].cancellationReason).toBeNull();
    });
  });

  describe('assignOrderToDelivery', () => {
    it('assigns ready order to delivery driver', async () => {
      txMocks.user.findUnique.mockResolvedValue({ id: 'driver-1', type: 'deliveryDriver' });
      txMocks.order.findUnique
        .mockResolvedValueOnce(makeOrder({ status: 'readyForDelivery' }))
        .mockResolvedValueOnce(
          makeOrder({ deliveryUserId: 'driver-1', status: 'assignedToDeliveryDriver' }),
        );
      txMocks.order.updateMany.mockResolvedValue({ count: 1 });

      const result = await assignOrderToDelivery('o1', 'driver-1', 'admin-1');
      expect(result.status).toBe('assignedToDeliveryDriver');
      expect(txMocks.orderStatusHistory.create).toHaveBeenCalled();
    });

    it('rejects non-driver user', async () => {
      txMocks.user.findUnique.mockResolvedValue({ id: 'u1', type: 'client' });

      await expect(assignOrderToDelivery('o1', 'u1', 'admin-1')).rejects.toMatchObject({
        code: 'INVALID_DELIVERY_DRIVER',
        statusCode: 400,
      });
    });
  });

  describe('unassignOrderFromDelivery', () => {
    it('returns order to readyForDelivery', async () => {
      txMocks.order.findUnique
        .mockResolvedValueOnce(
          makeOrder({ deliveryUserId: 'driver-1', status: 'assignedToDeliveryDriver' }),
        )
        .mockResolvedValueOnce(makeOrder({ deliveryUserId: null, status: 'readyForDelivery' }));
      txMocks.order.updateMany.mockResolvedValue({ count: 1 });

      const result = await unassignOrderFromDelivery('o1', 'admin-1');
      expect(result.status).toBe('readyForDelivery');
    });
  });

  describe('startOrderDelivering', () => {
    it('starts delivery for assigned driver', async () => {
      txMocks.order.updateMany.mockResolvedValue({ count: 1 });
      txMocks.order.findUnique.mockResolvedValue(
        makeOrder({ deliveryUserId: 'driver-1', status: 'delivering' }),
      );

      const result = await startOrderDelivering('deliveryDriver', 'o1', 'driver-1');
      expect(result.status).toBe('delivering');
    });
  });

  describe('markOrderDelivered', () => {
    it('marks order delivered for delivery driver with proof', async () => {
      txMocks.order.updateMany.mockResolvedValue({ count: 1 });
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'delivered' }));

      const result = await markOrderDelivered(
        'deliveryDriver',
        'o1',
        'driver-1',
        'https://cdn/proof.jpg',
      );
      expect(result.status).toBe('delivered');
    });

    it('requires delivery proof url', async () => {
      await expect(
        markOrderDelivered('deliveryDriver', 'o1', 'driver-1', ''),
      ).rejects.toMatchObject({
        code: 'DELIVERY_PROOF_REQUIRED',
        statusCode: 400,
      });
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
      txMocks.store.findFirst.mockResolvedValue(null);

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
      txMocks.store.findFirst.mockResolvedValue({ id: 'store-b', name: 'Other', active: true });

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
          deliveryUser: null,
          payment: null,
          store: { name: 'Store 1' },
          user: { address: 'Av. Perfil', numberId: 'V123', phone: '04140001122' },
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
      expect(result.data[0].deliveryAddress).toBe('Av. Perfil');
      expect(result.data[0].deliveryPhone).toBe('04140001122');
      expect(result.data[0].deliveryUserName).toBeNull();
      expect(result.data[0].deliveryUserPhone).toBeNull();
    });

    it('includes delivery driver name and phone when assigned', async () => {
      const prisma = (await import('../../prisma.js')).default;
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          ...makeOrder({
            deliveryAddress: 'Direccion pedido',
            deliveryPhone: '04241234567',
            deliveryUserId: 'driver-1',
            status: 'delivering',
          }),
          deliveryUser: {
            firstName: 'Jose',
            lastName: 'Perez',
            phone: '04141234567',
          },
          payment: null,
          store: { name: 'Altochama' },
          user: { address: 'Av. Perfil', numberId: '17322319', phone: '04140001122' },
          products: [],
        },
      ] as never);
      vi.mocked(prisma.order.count).mockResolvedValue(1);
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);

      const result = await listKitchenOrders(1, 10, 'admin');

      expect(result.data[0].deliveryUserName).toBe('Jose Perez');
      expect(result.data[0].deliveryUserPhone).toBe('04141234567');
      expect(result.data[0].deliveryAddress).toBe('Direccion pedido');
      expect(result.data[0].deliveryPhone).toBe('04241234567');
    });
  });

  describe('buildKitchenOrdersWhere', () => {
    it('excludes only pending when status is all (includes cancelled)', () => {
      expect(buildKitchenOrdersWhere({ status: 'all' })).toEqual({
        status: { notIn: ['pending'] },
      });
    });

    it('filters by case-sensitive id contains', () => {
      expect(buildKitchenOrdersWhere({ id: 'ABC' })).toEqual({
        id: { contains: 'ABC' },
        status: { notIn: ['pending'] },
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

    it('filters by createdAt range using Caracas half-open business days', () => {
      const createdFrom = new Date('2026-07-01T00:00:00.000Z');
      const createdTo = new Date('2026-07-15T00:00:00.000Z');
      const where = buildKitchenOrdersWhere({ createdFrom, createdTo });

      expect(where.createdAt?.gte?.toISOString()).toBe('2026-07-01T04:00:00.000Z');
      expect(where.createdAt?.lt?.toISOString()).toBe('2026-07-16T04:00:00.000Z');
      expect(where.status).toEqual({ notIn: ['pending'] });
    });

    it('today window includes 15/07 afternoon Caracas and excludes 14/07 afternoon', () => {
      const createdFrom = new Date('2026-07-15T00:00:00.000Z');
      const createdTo = new Date('2026-07-15T00:00:00.000Z');
      const where = buildKitchenOrdersWhere({ createdFrom, createdTo });
      const start = where.createdAt?.gte as Date;
      const endExclusive = where.createdAt?.lt as Date;

      const july15Afternoon = new Date('2026-07-15T18:38:07.000Z');
      const july14Afternoon = new Date('2026-07-14T18:40:17.000Z');

      expect(july15Afternoon.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(july15Afternoon.getTime()).toBeLessThan(endExclusive.getTime());
      expect(july14Afternoon.getTime()).toBeLessThan(start.getTime());
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

      await expect(adminSetOrderStatus('o1', 'cancelled', 'admin-1')).rejects.toMatchObject({
        code: 'ORDER_NOT_CANCELLABLE',
        statusCode: 400,
      });
    });

    it('throws ORDER_CONFLICT on concurrent update', async () => {
      txMocks.order.findUnique.mockResolvedValue(makeOrder({ status: 'paymentConfirmed' }));
      txMocks.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(adminSetOrderStatus('o1', 'preparing', 'admin-1')).rejects.toMatchObject({
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

  describe('markOrderDelivered non-driver forbidden', () => {
    it('rejects admin marking delivered', async () => {
      await expect(
        markOrderDelivered('superAdmin', 'o1', 'admin-1', 'https://cdn/proof.jpg'),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });

    it('throws ORDER_NOT_IN_DELIVERY when update fails', async () => {
      txMocks.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        markOrderDelivered('deliveryDriver', 'o1', 'driver-1', 'https://cdn/proof.jpg'),
      ).rejects.toMatchObject({
        code: 'ORDER_NOT_IN_DELIVERY',
        statusCode: 409,
      });
    });
  });
});
