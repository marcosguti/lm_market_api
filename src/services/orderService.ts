import type {
  Notification,
  Order,
  OrderStatus,
  Prisma as PrismaType,
  UserType,
} from '@prisma/client';

import { Prisma, PrismaClient } from '@prisma/client';

import prisma from '../prisma.js';
import { emitOrderUpdated } from '../realtime/socket.js';

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
  lineTotal: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderWithLines extends Omit<Order, 'products' | 'totalAmount'> {
  products: OrderLine[];
  totalAmount: number;
}

export interface OrderWithUser extends OrderWithLines {
  userNumberId: string;
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

export async function adminSetOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
): Promise<OrderWithLines> {
  return client.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
    if (!canTransitionByAdmin(order.status, toStatus)) {
      throw new OrderDomainError('INVALID_STATUS_TRANSITION', 'Invalid status transition', 400);
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
      throw new OrderDomainError('ORDER_CONFLICT', 'Order changed concurrently', 409);
    }

    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
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
        status: 'enReparto',
        version: { increment: 1 },
      },
      where: {
        deliveryUserId: null,
        id: orderId,
        status: 'listaParaReparto',
      },
    });
    if (result.count === 0) {
      throw new OrderDomainError('ORDER_NOT_AVAILABLE', 'Order is not available', 409);
    }
    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
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
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    if (order.status === 'pagoConfirmado') {
      return { changes: [], justConfirmed: false, order: serializeOrder(order) };
    }
    if (order.status !== 'pendiente') {
      throw new OrderDomainError('ORDER_NOT_PENDING', 'Order is not pending', 409);
    }

    const existing = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, existing);
    order = await updateOrderLinesInTx(tx, order.id, reconciled.lines);

    if (reconciled.lines.length === 0) {
      throw new OrderDomainError(
        'ORDER_EMPTY_AFTER_ADJUSTMENT',
        'Order changed because products are no longer available',
        409,
        { changes: reconciled.changes, order: serializeOrder(order) },
      );
    }

    for (const line of reconciled.lines) {
      const updateResult = await tx.product.updateMany({
        data: {
          totalStock: { decrement: line.quantity },
        },
        where: {
          active: true,
          code: line.code,
          OR: [{ totalStock: null }, { totalStock: { gte: line.quantity } }],
        },
      });
      if (updateResult.count === 0) {
        const retryReconciled = await reconcileLines(
          tx,
          reconciled.lines.map((l) => ({ code: l.code, quantity: l.quantity })),
        );
        const adjusted = await updateOrderLinesInTx(tx, order.id, retryReconciled.lines);
        throw new OrderDomainError(
          'ORDER_INVENTORY_CHANGED',
          'Order changed because stock changed while confirming',
          409,
          { changes: retryReconciled.changes, order: serializeOrder(adjusted) },
        );
      }
    }

    const updated = await tx.order.updateMany({
      data: {
        paidAt: new Date(),
        status: 'pagoConfirmado',
        version: { increment: 1 },
      },
      where: {
        id: order.id,
        status: 'pendiente',
        userId,
      },
    });
    if (updated.count === 0) {
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (!fresh) throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
      if (fresh.status === 'pagoConfirmado') {
        return { changes: [], justConfirmed: false, order: serializeOrder(fresh) };
      }
      throw new OrderDomainError('ORDER_NOT_PENDING', 'Order is not pending', 409);
    }

    const paid = await tx.order.findUnique({ where: { id: order.id } });
    if (!paid) throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
    return { changes: reconciled.changes, justConfirmed: true, order: serializeOrder(paid) };
  });
}

export async function createOrderStatusNotification(
  order: OrderWithLines,
  previousStatus: OrderStatus,
): Promise<void> {
  await client.notification.create({
    data: {
      body: `Tu orden cambió de ${previousStatus} a ${order.status}`,
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

    const existingLines = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, existingLines);
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
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
    }
    if (order.status !== 'pendiente') {
      return { changes: [], order: serializeOrder(order) };
    }

    const currentLines = toOrderLines(order.products as Prisma.JsonValue).map((line) => ({
      code: line.code,
      quantity: line.quantity,
    }));
    const reconciled = await reconcileLines(tx, currentLines);
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
    status: { not: 'pendiente' },
    userId,
  };
  const [data, total] = await Promise.all([
    client.order.findMany({
      orderBy: { createdAt: 'desc' },
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
    status: 'listaParaReparto',
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
    status: 'enReparto',
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
    status: { notIn: ['pendiente', 'cancelada'] },
  };
  const [data, total] = await Promise.all([
    client.order.findMany({
      include: { user: { select: { numberId: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      where,
    }),
    client.order.count({ where }),
  ]);
  return {
    data: data.map((order) => ({
      ...serializeOrder(order),
      userNumberId: order.user.numberId,
    })),
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
    throw new OrderDomainError('NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
  }
}

export async function markOrderDelivered(
  actorType: UserType,
  orderId: string,
  userId: string,
): Promise<OrderWithLines> {
  const where: PrismaType.OrderWhereInput =
    actorType === 'admin' || actorType === 'superAdmin'
      ? { id: orderId, status: 'enReparto' }
      : { deliveryUserId: userId, id: orderId, status: 'enReparto' };

  return client.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      data: {
        status: 'entregada',
        version: { increment: 1 },
      },
      where,
    });
    if (result.count === 0) {
      throw new OrderDomainError(
        'ORDER_NOT_IN_DELIVERY',
        'Order is not in delivery or not assigned to this driver',
        409,
      );
    }
    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
    return serializeOrder(updated);
  });
}

export async function updatePendingOrderLines(
  userId: string,
  orderId: string,
  lines: CartLineInput[],
): Promise<{ changes: InventoryChange[]; order: OrderWithLines }> {
  const result = await client.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Order not found', 404);
    }
    if (order.status !== 'pendiente') {
      throw new OrderDomainError('ORDER_NOT_PENDING', 'Order is not pending', 409);
    }

    const reconciled = await reconcileLines(tx, lines);
    const updated = await updateOrderLinesInTx(tx, order.id, reconciled.lines);
    return { changes: reconciled.changes, order: serializeOrder(updated) };
  });
  emitOrderUpdated(userId, result.order);
  return result;
}

function canTransitionByAdmin(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'cancelada') return from !== 'cancelada';
  if (from === 'pagoConfirmado' && to === 'preparando') return true;
  if (from === 'preparando' && to === 'listaParaReparto') return true;
  if (from === 'enReparto' && to === 'entregada') return true;
  return false;
}

function computeTotal(lines: OrderLine[]): number {
  return Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
}

async function getPendingOrderForUserInTx(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<null | Order> {
  return tx.order.findFirst({
    orderBy: { createdAt: 'desc' },
    where: {
      status: 'pendiente',
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

    const stock = product.totalStock;
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
    const unitPrice = Number(product.price.toString());
    resultLines.push({
      code: line.code,
      description: product.description,
      lineTotal: Number((quantity * unitPrice).toFixed(2)),
      name: product.name,
      quantity,
      unitPrice,
    });
  }

  return { changes, lines: resultLines };
}

function serializeOrder(order: Order): OrderWithLines {
  return {
    ...order,
    products: toOrderLines(order.products as Prisma.JsonValue),
    totalAmount: Number(order.totalAmount.toString()),
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
