import type {
  Notification,
  Order,
  OrderStatus,
  Payment,
  Prisma as PrismaType,
  UserType,
} from '@prisma/client';

import { Prisma, PrismaClient } from '@prisma/client';

import { megasoftConfig, resolveMegasoftAmount } from '../config/megasoft.js';
import prisma from '../prisma.js';
import { emitKitchenNewPaid, emitOrderUpdated, emitUserNotification } from '../realtime/socket.js';
import { formatOrderStatusChangeBody } from '../utils/orderStatusLabels.js';
import { MegasoftPaymentRejectedError } from './megasoft/types.js';

export interface CartLineInput {
  code: string;
  quantity: number;
}

export interface InventoryChange {
  available: number;
  code: string;
  reason: 'missing' | 'out_of_stock' | 'quantity_adjusted';
  requested: number;
}

export interface OrderLine {
  code: string;
  description: null | string;
  imageUrl?: null | string;
  lineTotal: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderWithLines extends Omit<Order, 'products' | 'totalAmount'> {
  products: OrderLine[];
  storeName?: null | string;
  totalAmount: number;
}

export interface OrderWithUser extends OrderWithLines {
  payment: null | SerializedPayment;
  userNumberId: string;
}

export interface SerializedPayment {
  createdAt: Date;
  id: string;
  method: Payment['method'];
  paidAt: Date;
  reference: string;
  screenshotUrl: null | string;
  verifiedAt: Date | null;
  verifiedAutomatically: boolean;
  verifiedBy: null | string;
}

export class OrderDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const client = prisma as PrismaClient;

export interface ConfirmPaymentDetails {
  method: 'binance' | 'cash' | 'mobilePayment' | 'zelle';
  paidAt?: Date | null;
  reference?: null | string;
  screenshotUrl?: null | string;
}

export interface MobilePaymentP2cDetails {
  amount: number;
  clientBankCode: string;
  clientPhone: string;
  nationalId: string;
  reference: string;
}

export async function adminSetOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
): Promise<OrderWithLines> {
  return client.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    if (toStatus === 'cancelled' && !CANCELLABLE_STATUSES.includes(order.status)) {
      throw new OrderDomainError(
        'ORDER_NOT_CANCELLABLE',
        'La orden ya no se puede cancelar en su estado actual',
        400,
      );
    }
    if (!canTransitionByAdmin(order.status, toStatus)) {
      throw new OrderDomainError(
        'INVALID_STATUS_TRANSITION',
        'Transición de estado no válida',
        400,
      );
    }

    const result = await tx.order.updateMany({
      data: {
        status: toStatus,
        version: { increment: 1 },
      },
      where: {
        id: orderId,
        status: order.status,
      },
    });
    if (result.count === 0) {
      throw new OrderDomainError('ORDER_CONFLICT', 'El pedido cambió de forma concurrente', 409);
    }

    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return serializeOrder(updated);
  });
}

export async function claimDeliveryOrder(
  orderId: string,
  deliveryUserId: string,
): Promise<OrderWithLines> {
  return client.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      data: {
        deliveryUserId,
        status: 'outForDelivery',
        version: { increment: 1 },
      },
      where: {
        deliveryUserId: null,
        id: orderId,
        status: 'readyForDelivery',
      },
    });
    if (result.count === 0) {
      throw new OrderDomainError('ORDER_NOT_AVAILABLE', 'El pedido no está disponible', 409);
    }
    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return serializeOrder(updated);
  });
}

export async function confirmPendingOrderPayment(
  userId: string,
  orderId: string,
): Promise<{ changes: InventoryChange[]; justConfirmed: boolean; order: OrderWithLines }> {
  return client.$transaction(async (tx) => {
    let order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    }

    if (order.status === 'paymentConfirmed') {
      return { changes: [], justConfirmed: false, order: serializeOrder(order) };
    }
    if (order.status !== 'pending') {
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    const existing = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, existing, order.storeId);
    order = await updateOrderLinesInTx(tx, order.id, reconciled.lines);

    if (reconciled.lines.length === 0) {
      throw new OrderDomainError(
        'ORDER_EMPTY_AFTER_ADJUSTMENT',
        'El pedido cambió porque los productos ya no están disponibles',
        409,
        { changes: reconciled.changes, order: serializeOrder(order) },
      );
    }

    for (const line of reconciled.lines) {
      const updateResult = order.storeId
        ? await tx.productStore.updateMany({
            data: {
              stockQuantity: { decrement: line.quantity },
            },
            where: {
              product: { active: true, code: line.code },
              stockQuantity: { gte: line.quantity },
              storeId: order.storeId,
            },
          })
        : await tx.product.updateMany({
            data: {},
            where: {
              active: true,
              code: line.code,
              productStores: { some: { stockQuantity: { gte: line.quantity } } },
            },
          });
      if (updateResult.count === 0) {
        const retryReconciled = await reconcileLines(
          tx,
          reconciled.lines.map((l) => ({ code: l.code, quantity: l.quantity })),
          order.storeId,
        );
        const adjusted = await updateOrderLinesInTx(tx, order.id, retryReconciled.lines);
        throw new OrderDomainError(
          'ORDER_INVENTORY_CHANGED',
          'El pedido cambió porque el stock cambió durante la confirmación',
          409,
          { changes: retryReconciled.changes, order: serializeOrder(adjusted) },
        );
      }
    }

    const updated = await tx.order.updateMany({
      data: {
        paidAt: new Date(),
        status: 'paymentConfirmed',
        version: { increment: 1 },
      },
      where: {
        id: order.id,
        status: 'pending',
        userId,
      },
    });
    if (updated.count === 0) {
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (!fresh) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
      if (fresh.status === 'paymentConfirmed') {
        return { changes: [], justConfirmed: false, order: serializeOrder(fresh) };
      }
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    const paid = await tx.order.findUnique({ where: { id: order.id } });
    if (!paid) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return { changes: reconciled.changes, justConfirmed: true, order: serializeOrder(paid) };
  });
}

export async function confirmPendingOrderPaymentWithDetails(
  userId: string,
  orderId: string,
  details: ConfirmPaymentDetails,
): Promise<{ changes: InventoryChange[]; order: OrderWithLines }> {
  return client.$transaction(async (tx) => {
    let order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    }
    if (order.status !== 'pending') {
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    const existing = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, existing, order.storeId);
    order = await updateOrderLinesInTx(tx, order.id, reconciled.lines);

    if (reconciled.lines.length === 0) {
      throw new OrderDomainError(
        'ORDER_EMPTY_AFTER_ADJUSTMENT',
        'El pedido cambió porque los productos ya no están disponibles',
        409,
        { changes: reconciled.changes, order: serializeOrder(order) },
      );
    }

    for (const line of reconciled.lines) {
      const updateResult = order.storeId
        ? await tx.productStore.updateMany({
            data: {
              stockQuantity: { decrement: line.quantity },
            },
            where: {
              product: { active: true, code: line.code },
              stockQuantity: { gte: line.quantity },
              storeId: order.storeId,
            },
          })
        : await tx.product.updateMany({
            data: {},
            where: {
              active: true,
              code: line.code,
              productStores: { some: { stockQuantity: { gte: line.quantity } } },
            },
          });
      if (updateResult.count === 0) {
        const retryReconciled = await reconcileLines(
          tx,
          reconciled.lines.map((l) => ({ code: l.code, quantity: l.quantity })),
          order.storeId,
        );
        const adjusted = await updateOrderLinesInTx(tx, order.id, retryReconciled.lines);
        throw new OrderDomainError(
          'ORDER_INVENTORY_CHANGED',
          'El pedido cambió porque el stock cambió durante la confirmación',
          409,
          { changes: retryReconciled.changes, order: serializeOrder(adjusted) },
        );
      }
    }

    const paidAt = details.paidAt ?? new Date();
    const updatedCount = await tx.order.updateMany({
      data: {
        paidAt,
        paymentDate: details.paidAt ?? paidAt,
        paymentMethod: details.method,
        paymentReference: details.reference,
        paymentScreenshotUrl: details.screenshotUrl,
        status: 'paymentConfirmed',
        version: { increment: 1 },
      },
      where: { id: order.id, status: 'pending', userId },
    });

    if (updatedCount.count === 0) {
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (!fresh) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
      if (fresh.status === 'paymentConfirmed') {
        return { changes: [], order: serializeOrder(fresh) };
      }
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    if (details.method !== 'cash') {
      await tx.payment.upsert({
        create: {
          method: details.method,
          orderId: order.id,
          paidAt,
          reference: details.reference ?? '',
          screenshotUrl: details.screenshotUrl,
        },
        update: {
          method: details.method,
          paidAt,
          reference: details.reference ?? '',
          screenshotUrl: details.screenshotUrl,
        },
        where: { orderId: order.id },
      });
    }

    const paid = await tx.order.findUnique({ where: { id: order.id } });
    if (!paid) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return { changes: reconciled.changes, order: serializeOrder(paid) };
  });
}

export async function createOrderStatusNotification(
  order: OrderWithLines,
  previousStatus: OrderStatus,
): Promise<void> {
  await client.notification.create({
    data: {
      body: formatOrderStatusChangeBody(previousStatus, order.status),
      orderId: order.id,
      payload: {
        newStatus: order.status,
        orderId: order.id,
        previousStatus,
      },
      title: 'Actualización de orden',
      type: 'ORDER_STATUS_CHANGED',
      userId: order.userId,
    },
  });
}

export async function ensurePendingCart(
  userId: string,
  storeId?: string,
): Promise<{ changes: InventoryChange[]; order: OrderWithLines }> {
  return client.$transaction(async (tx) => {
    let order = await getPendingOrderForUserInTx(tx, userId);
    if (!order) {
      order = await tx.order.create({
        data: {
          products: [],
          totalAmount: new Prisma.Decimal(0),
          userId,
        },
      });
    }

    order = await applyStoreIdToPendingOrder(tx, order, storeId);

    const existingLines = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, existingLines, order.storeId);
    if (
      reconciled.changes.length > 0 ||
      JSON.stringify(toOrderLines(order.products as Prisma.JsonValue)) !==
        JSON.stringify(reconciled.lines)
    ) {
      order = await updateOrderLinesInTx(tx, order.id, reconciled.lines);
    }

    return { changes: reconciled.changes, order: serializeOrder(order) };
  });
}

export async function getAnyOrderById(orderId: string): Promise<null | OrderWithLines> {
  const order = await client.order.findUnique({ where: { id: orderId } });
  return order ? serializeOrder(order) : null;
}

export async function getOrderByIdForUser(
  userId: string,
  orderId: string,
): Promise<{ changes: InventoryChange[]; order: OrderWithLines }> {
  return client.$transaction(async (tx) => {
    let order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    }
    if (order.status !== 'pending') {
      return { changes: [], order: serializeOrder(order) };
    }

    const currentLines = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, currentLines, order.storeId);
    if (
      reconciled.changes.length > 0 ||
      JSON.stringify(toOrderLines(order.products as Prisma.JsonValue)) !==
        JSON.stringify(reconciled.lines)
    ) {
      order = await updateOrderLinesInTx(tx, order.id, reconciled.lines);
    }
    return { changes: reconciled.changes, order: serializeOrder(order) };
  });
}

export async function getUserOrderHistory(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{
  data: OrderWithLines[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const skip = (page - 1) * pageSize;
  const where: Prisma.OrderWhereInput = {
    status: { not: 'pending' },
    userId,
  };
  const [data, total] = await Promise.all([
    client.order.findMany({
      include: { store: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      where,
    }),
    client.order.count({ where }),
  ]);
  const serialized = data.map((order) => ({
    ...serializeOrder(order),
    storeName: order.store?.name ?? null,
  }));
  return {
    data: await enrichOrdersWithProductImages(serialized),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function listDeliveryAvailable(
  page: number,
  pageSize: number,
): Promise<{
  data: OrderWithLines[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const skip = (page - 1) * pageSize;
  const where: PrismaType.OrderWhereInput = {
    deliveryUserId: null,
    status: 'readyForDelivery',
  };
  const [data, total] = await Promise.all([
    client.order.findMany({
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
      where,
    }),
    client.order.count({ where }),
  ]);
  return {
    data: data.map(serializeOrder),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function listDeliveryMine(
  deliveryUserId: string,
  page: number,
  pageSize: number,
): Promise<{
  data: OrderWithLines[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const skip = (page - 1) * pageSize;
  const where: PrismaType.OrderWhereInput = {
    deliveryUserId,
    status: 'outForDelivery',
  };
  const [data, total] = await Promise.all([
    client.order.findMany({
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
      where,
    }),
    client.order.count({ where }),
  ]);
  return {
    data: data.map(serializeOrder),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function listKitchenOrders(
  page: number,
  pageSize: number,
  _userType: UserType,
): Promise<{
  data: OrderWithUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const skip = (page - 1) * pageSize;
  const where: PrismaType.OrderWhereInput = {
    status: { notIn: ['pending', 'cancelled'] },
  };
  const [data, total] = await Promise.all([
    client.order.findMany({
      include: {
        payment: true,
        store: { select: { name: true } },
        user: { select: { numberId: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      where,
    }),
    client.order.count({ where }),
  ]);
  const serialized = data.map((order) => ({
    ...serializeOrder(order),
    payment: order.payment ? serializePayment(order.payment) : null,
    storeName: order.store?.name ?? null,
    userNumberId: order.user.numberId,
  }));
  return {
    data: await enrichOrdersWithProductImages(serialized),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function listNotificationsForUser(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{
  data: Notification[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const skip = (page - 1) * pageSize;
  const where: PrismaType.NotificationWhereInput = { userId };
  const [data, total] = await Promise.all([
    client.notification.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      where,
    }),
    client.notification.count({ where }),
  ]);
  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const result = await client.notification.updateMany({
    data: { readAt: new Date() },
    where: {
      readAt: null,
      userId,
    },
  });
  return result.count;
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const result = await client.notification.updateMany({
    data: { readAt: new Date() },
    where: {
      id: notificationId,
      userId,
    },
  });
  if (result.count === 0) {
    throw new OrderDomainError('NOTIFICATION_NOT_FOUND', 'Notificación no encontrada', 404);
  }
}

export async function markOrderDelivered(
  actorType: UserType,
  orderId: string,
  userId: string,
): Promise<OrderWithLines> {
  const where: PrismaType.OrderWhereInput =
    actorType === 'admin' || actorType === 'superAdmin'
      ? { id: orderId, status: 'outForDelivery' }
      : { deliveryUserId: userId, id: orderId, status: 'outForDelivery' };

  return client.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      data: {
        status: 'delivered',
        version: { increment: 1 },
      },
      where,
    });
    if (result.count === 0) {
      throw new OrderDomainError(
        'ORDER_NOT_IN_DELIVERY',
        'El pedido no está en reparto o no está asignado a este conductor',
        409,
      );
    }
    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return serializeOrder(updated);
  });
}

export async function notifyOrderPaid(
  order: OrderWithLines,
  previousStatus: OrderStatus = 'pending',
): Promise<void> {
  await createOrderStatusNotification(order, previousStatus);
  emitUserNotification(order.userId, {
    body: formatOrderStatusChangeBody(previousStatus, order.status),
    newStatus: order.status,
    orderId: order.id,
    previousStatus,
    status: order.status,
    title: 'Actualización de orden',
    type: 'ORDER_STATUS_CHANGED',
  });
  emitOrderUpdated(order.userId, {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
  });
  emitKitchenNewPaid(order);
}

export async function updatePendingOrderLines(
  userId: string,
  orderId: string,
  lines: CartLineInput[],
  storeId?: string,
): Promise<{ changes: InventoryChange[]; order: OrderWithLines }> {
  const result = await client.$transaction(async (tx) => {
    let order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    }
    if (order.status !== 'pending') {
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    order = await applyStoreIdToPendingOrder(tx, order, storeId);

    const reconciled = await reconcileLines(tx, lines, order.storeId);
    const updated = await updateOrderLinesInTx(tx, order.id, reconciled.lines);
    return { changes: reconciled.changes, order: serializeOrder(updated) };
  });
  emitOrderUpdated(userId, result.order);
  return result;
}

export async function verifyMobilePaymentP2c(
  userId: string,
  orderId: string,
  details: MobilePaymentP2cDetails,
): Promise<{ changes: InventoryChange[]; order: OrderWithLines; voucher: string }> {
  const reconciledPreview = await client.$transaction(async (tx) => {
    let order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    }
    if (order.status !== 'pending') {
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    const existing = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, existing, order.storeId);
    order = await updateOrderLinesInTx(tx, order.id, reconciled.lines);

    if (reconciled.lines.length === 0) {
      throw new OrderDomainError(
        'ORDER_EMPTY_AFTER_ADJUSTMENT',
        'El pedido cambió porque los productos ya no están disponibles',
        409,
        { changes: reconciled.changes, order: serializeOrder(order) },
      );
    }

    return { changes: reconciled.changes, order: serializeOrder(order) };
  });

  const invoice = reconciledPreview.order.id.replace(/-/g, '').slice(0, 20);
  const orderAmount = reconciledPreview.order.totalAmount;
  const amount = resolveMegasoftAmount(orderAmount);

  if (!megasoftConfig.certHardcoded && megasoftConfig.amountOverride === null) {
    if (Math.abs(details.amount - amount) > 0.01) {
      throw new OrderDomainError(
        'INVALID_PAYMENT_AMOUNT',
        'El monto enviado no coincide con el total del pedido',
        400,
      );
    }
  }

  if (amount <= 0) {
    throw new OrderDomainError(
      'ORDER_INVALID_AMOUNT',
      'El monto del pedido debe ser mayor a cero para verificar el pago móvil',
      400,
    );
  }

  const { isMegasoftP2cApproved, megasoftQueryP2cStatus, verifyP2cPayment } =
    await import('./megasoft/index.js');

  let megasoftResult;
  try {
    megasoftResult = await verifyP2cPayment({
      amount,
      clientBankCode: details.clientBankCode,
      clientPhone: details.clientPhone,
      invoice,
      nationalId: details.nationalId,
      reference: details.reference,
    });
  } catch (err) {
    if (err instanceof MegasoftPaymentRejectedError && err.result.control) {
      const statusResult = await megasoftQueryP2cStatus(err.result.control);
      if (isMegasoftP2cApproved(statusResult)) {
        megasoftResult = statusResult;
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  return client.$transaction(async (tx) => {
    let order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    }
    if (order.status !== 'pending') {
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    const existing = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, existing, order.storeId);
    order = await updateOrderLinesInTx(tx, order.id, reconciled.lines);

    if (reconciled.lines.length === 0) {
      throw new OrderDomainError(
        'ORDER_EMPTY_AFTER_ADJUSTMENT',
        'El pedido cambió porque los productos ya no están disponibles',
        409,
        { changes: reconciled.changes, order: serializeOrder(order) },
      );
    }

    for (const line of reconciled.lines) {
      const updateResult = order.storeId
        ? await tx.productStore.updateMany({
            data: {
              stockQuantity: { decrement: line.quantity },
            },
            where: {
              product: { active: true, code: line.code },
              stockQuantity: { gte: line.quantity },
              storeId: order.storeId,
            },
          })
        : await tx.product.updateMany({
            data: {},
            where: {
              active: true,
              code: line.code,
              productStores: { some: { stockQuantity: { gte: line.quantity } } },
            },
          });
      if (updateResult.count === 0) {
        const retryReconciled = await reconcileLines(
          tx,
          reconciled.lines.map((l) => ({ code: l.code, quantity: l.quantity })),
          order.storeId,
        );
        const adjusted = await updateOrderLinesInTx(tx, order.id, retryReconciled.lines);
        throw new OrderDomainError(
          'ORDER_INVENTORY_CHANGED',
          'El pedido cambió porque el stock cambió durante la confirmación',
          409,
          { changes: retryReconciled.changes, order: serializeOrder(adjusted) },
        );
      }
    }

    const paidAt = new Date();
    const updated = await tx.order.updateMany({
      data: {
        paidAt,
        paymentDate: paidAt,
        paymentMethod: 'mobilePayment',
        paymentReference: details.reference,
        status: 'paymentConfirmed',
        version: { increment: 1 },
      },
      where: {
        id: order.id,
        status: 'pending',
        userId,
      },
    });
    if (updated.count === 0) {
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (!fresh) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
      if (fresh.status === 'paymentConfirmed') {
        return {
          changes: [],
          order: serializeOrder(fresh),
          voucher: megasoftResult.voucher,
        };
      }
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    await tx.payment.upsert({
      create: {
        gatewayControl: megasoftResult.control,
        gatewayRawResponse: { rawXml: megasoftResult.rawXml },
        gatewayStatus: megasoftResult.status,
        gatewayVoucher: megasoftResult.voucher,
        method: 'mobilePayment',
        orderId: order.id,
        paidAt,
        payerBankCode: details.clientBankCode,
        payerCid: details.nationalId,
        payerPhone: details.clientPhone,
        reference: details.reference,
        verifiedAt: paidAt,
        verifiedAutomatically: true,
      },
      update: {
        gatewayControl: megasoftResult.control,
        gatewayRawResponse: { rawXml: megasoftResult.rawXml },
        gatewayStatus: megasoftResult.status,
        gatewayVoucher: megasoftResult.voucher,
        method: 'mobilePayment',
        paidAt,
        payerBankCode: details.clientBankCode,
        payerCid: details.nationalId,
        payerPhone: details.clientPhone,
        reference: details.reference,
        verifiedAt: paidAt,
        verifiedAutomatically: true,
      },
      where: { orderId: order.id },
    });

    const paid = await tx.order.findUnique({ where: { id: order.id } });
    if (!paid) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return {
      changes: reconciled.changes,
      order: serializeOrder(paid),
      voucher: megasoftResult.voucher,
    };
  });
}

export async function verifyPaymentByAdmin(
  orderId: string,
  adminUserId: string,
  verify: boolean,
): Promise<OrderWithLines> {
  return client.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    if (order.status !== 'pending') {
      throw new OrderDomainError('INVALID_STATUS_TRANSITION', 'El pedido no está pendiente', 400);
    }

    if (verify) {
      const updated = await tx.order.update({
        data: {
          status: 'paymentConfirmed',
          version: { increment: 1 },
        },
        where: { id: orderId, status: 'pending' },
      });

      await tx.payment.update({
        data: {
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
        },
        where: { orderId },
      });

      return serializeOrder(updated);
    }

    await tx.payment.update({
      data: {
        verifiedAt: null,
        verifiedBy: null,
      },
      where: { orderId },
    });

    return serializeOrder(order);
  });
}

async function applyStoreIdToPendingOrder(
  tx: Prisma.TransactionClient,
  order: Order,
  requestedStoreId?: string,
): Promise<Order> {
  const storeId = requestedStoreId?.trim();
  if (!storeId) return order;

  const store = await tx.store.findUnique({ where: { id: storeId } });
  if (!store) {
    throw new OrderDomainError('STORE_NOT_FOUND', 'Tienda no encontrada', 400);
  }

  const existingLines = toOrderLines(order.products as Prisma.JsonValue);
  if (order.storeId && order.storeId !== storeId && existingLines.length > 0) {
    throw new OrderDomainError(
      'STORE_MISMATCH',
      'La orden pertenece a otra tienda. Vacía el carrito o cambia de tienda desde el catálogo.',
      409,
    );
  }

  if (order.storeId === storeId) return order;

  return tx.order.update({
    data: { storeId },
    where: { id: order.id },
  });
}

const CANCELLABLE_STATUSES: OrderStatus[] = ['pending', 'paymentConfirmed', 'preparing'];

export function applyImageUrlsToOrderLines(
  lines: OrderLine[],
  imagesByCode: Map<string, null | string>,
): OrderLine[] {
  return lines.map((line) => {
    if (line.imageUrl) return line;
    const imageUrl = imagesByCode.get(line.code);
    if (!imageUrl) return line;
    return { ...line, imageUrl };
  });
}

function canTransitionByAdmin(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'cancelled') return CANCELLABLE_STATUSES.includes(from);
  if (from === 'pending' && to === 'paymentConfirmed') return true;
  if (from === 'paymentConfirmed' && to === 'preparing') return true;
  if (from === 'preparing' && to === 'readyForDelivery') return true;
  if (from === 'outForDelivery' && to === 'delivered') return true;
  return false;
}

function computeTotal(lines: OrderLine[]): number {
  return Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
}

async function enrichOrdersWithProductImages<T extends OrderWithLines>(orders: T[]): Promise<T[]> {
  const codes = new Set<string>();
  for (const order of orders) {
    for (const line of order.products) {
      if (!line.imageUrl) codes.add(line.code);
    }
  }
  if (codes.size === 0) return orders;

  const products = await client.product.findMany({
    select: { code: true, imageUrl: true },
    where: { code: { in: Array.from(codes) } },
  });
  const imagesByCode = new Map(products.map((p) => [p.code, p.imageUrl ?? null]));

  return orders.map((order) => ({
    ...order,
    products: applyImageUrlsToOrderLines(order.products, imagesByCode),
  }));
}

async function getPendingOrderForUserInTx(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<null | Order> {
  return tx.order.findFirst({
    orderBy: { createdAt: 'desc' },
    where: {
      status: 'pending',
      userId,
    },
  });
}

function mergeInputsByCode(inputs: CartLineInput[]): CartLineInput[] {
  const map = new Map<string, number>();
  for (const input of inputs) {
    const code = input.code.trim();
    if (!code) continue;
    const qty = Math.max(0, Math.trunc(input.quantity));
    if (qty <= 0) continue;
    map.set(code, (map.get(code) ?? 0) + qty);
  }
  return Array.from(map.entries()).map(([code, quantity]) => ({ code, quantity }));
}

async function reconcileLines(
  tx: Prisma.TransactionClient,
  lines: CartLineInput[],
  storeId: null | string,
): Promise<{ changes: InventoryChange[]; lines: OrderLine[] }> {
  const normalized = mergeInputsByCode(lines);
  if (normalized.length === 0) return { changes: [], lines: [] };

  const codes = normalized.map((line) => line.code);
  const products = await tx.product.findMany({
    where: {
      active: true,
      code: { in: codes },
    },
  });
  const productsByCode = new Map(products.map((p) => [p.code, p]));

  const effectiveStoreId = await resolveEffectiveStoreId(tx, storeId);
  const productStores = effectiveStoreId
    ? await tx.productStore.findMany({
        where: {
          productId: { in: products.map((p) => p.id) },
          storeId: effectiveStoreId,
        },
      })
    : [];
  const productStoresByProductId = new Map(productStores.map((ps) => [ps.productId, ps]));

  const resultLines: OrderLine[] = [];
  const changes: InventoryChange[] = [];

  for (const line of normalized) {
    const product = productsByCode.get(line.code);
    if (!product) {
      changes.push({
        available: 0,
        code: line.code,
        reason: 'missing',
        requested: line.quantity,
      });
      continue;
    }

    const productStore = productStoresByProductId.get(product.id);
    const stock = productStore?.stockQuantity ?? null;
    const available = stock === null || stock === undefined ? Number.MAX_SAFE_INTEGER : stock;
    if (available <= 0) {
      changes.push({
        available: 0,
        code: line.code,
        reason: 'out_of_stock',
        requested: line.quantity,
      });
      continue;
    }

    const quantity = Math.min(line.quantity, available);
    if (quantity !== line.quantity) {
      changes.push({
        available,
        code: line.code,
        reason: 'quantity_adjusted',
        requested: line.quantity,
      });
    }
    const unitPrice = productStore ? Number(productStore.price.toString()) : 0;
    resultLines.push({
      code: line.code,
      description: product.description,
      imageUrl: product.imageUrl ?? null,
      lineTotal: Number((quantity * unitPrice).toFixed(2)),
      name: product.name,
      quantity,
      unitPrice,
    });
  }

  return { changes, lines: resultLines };
}

async function resolveEffectiveStoreId(
  tx: Prisma.TransactionClient,
  storeId: null | string,
): Promise<null | string> {
  if (storeId) return storeId;
  const stores = await tx.store.findMany({ select: { id: true }, take: 2 });
  return stores.length === 1 ? stores[0].id : null;
}

function serializeOrder(order: Order): OrderWithLines {
  return {
    ...order,
    products: toOrderLines(order.products as Prisma.JsonValue),
    totalAmount: Number(order.totalAmount.toString()),
  };
}

function serializePayment(payment: Payment): SerializedPayment {
  return {
    createdAt: payment.createdAt,
    id: payment.id,
    method: payment.method,
    paidAt: payment.paidAt,
    reference: payment.reference,
    screenshotUrl: payment.screenshotUrl,
    verifiedAt: payment.verifiedAt,
    verifiedAutomatically: payment.verifiedAutomatically,
    verifiedBy: payment.verifiedBy,
  };
}

function toOrderLines(value: Prisma.JsonValue): OrderLine[] {
  if (!Array.isArray(value)) return [];
  const parsed: OrderLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const maybe = item as Partial<OrderLine>;
    if (
      typeof maybe.code !== 'string' ||
      typeof maybe.name !== 'string' ||
      typeof maybe.quantity !== 'number' ||
      typeof maybe.unitPrice !== 'number'
    ) {
      continue;
    }
    parsed.push({
      code: maybe.code,
      description: typeof maybe.description === 'string' ? maybe.description : null,
      imageUrl: typeof maybe.imageUrl === 'string' ? maybe.imageUrl : null,
      lineTotal:
        typeof maybe.lineTotal === 'number'
          ? maybe.lineTotal
          : Number((maybe.quantity * maybe.unitPrice).toFixed(2)),
      name: maybe.name,
      quantity: Math.max(1, Math.trunc(maybe.quantity)),
      unitPrice: maybe.unitPrice,
    });
  }
  return parsed;
}

async function updateOrderLinesInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  lines: OrderLine[],
): Promise<Order> {
  return tx.order.update({
    data: {
      products: lines as unknown as Prisma.InputJsonValue,
      totalAmount: new Prisma.Decimal(computeTotal(lines)),
      version: { increment: 1 },
    },
    where: { id: orderId },
  });
}
