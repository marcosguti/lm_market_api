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
import { sendPushToUser } from '../libs/fcm/index.js';
import { sendNewOrderForAdminEmail } from '../libs/sendEmail/index.js';
import {
  assertAdminCanAccessOrder as assertAdminCanAccessOrderScope,
  StoreScopeError,
} from '../middlewares/storeScope.js';
import prisma from '../prisma.js';
import { emitKitchenNewPaid, emitOrderUpdated, emitUserNotification } from '../realtime/socket.js';
import { startOfBusinessDayCaracas, startOfNextBusinessDayCaracas } from '../utils/businessDay.js';
import { formatOrderStatusChangeBody, formatOrderStatusLabel } from '../utils/orderStatusLabels.js';
import { getUsdVesRate } from './bcvExchangeRate.js';
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

export interface OrderWithLines extends Omit<
  Order,
  'deliveryLatitude' | 'deliveryLongitude' | 'exchangeRate' | 'products' | 'totalAmount'
> {
  deliveryLatitude: null | number;
  deliveryLongitude: null | number;
  exchangeRate: null | number;
  products: OrderLine[];
  storeName?: null | string;
  totalAmount: number;
  totalAmountBs: null | number;
}

export interface OrderWithUser extends OrderWithLines {
  deliveryUserName: null | string;
  deliveryUserPhone: null | string;
  payment: null | SerializedPayment;
  userNumberId: string;
}

export interface SerializedPayment {
  createdAt: Date;
  id: string;
  method: Payment['method'];
  note: null | string;
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

export function assertAdminCanAccessOrder(
  actorType: undefined | UserType,
  actorStoreId: null | string | undefined,
  order: { storeId: null | string },
): void {
  try {
    assertAdminCanAccessOrderScope(actorType, actorStoreId, order);
  } catch (err) {
    if (err instanceof StoreScopeError) {
      throw new OrderDomainError(err.code, err.message, err.statusCode);
    }
    throw err;
  }
}

const client = prisma as PrismaClient;

export interface ConfirmPaymentDetails {
  customerNotes?: null | string;
  deliveryAddress?: null | string;
  deliveryLatitude?: null | number;
  deliveryLongitude?: null | number;
  method: 'binance' | 'cash' | 'mobilePayment' | 'zelle';
  note?: null | string;
  paidAt?: Date | null;
  reference?: null | string;
  screenshotUrl?: null | string;
}

export interface DeliveryDriverForAssign {
  busy: boolean;
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  storeId: null | string;
}

export interface KitchenOrdersFilters {
  createdFrom?: Date;
  createdTo?: Date;
  id?: string;
  status?: 'all' | OrderStatus;
  storeId?: string;
}

export interface MobilePaymentP2cDetails {
  amount: number;
  clientBankCode: string;
  clientPhone: string;
  customerNotes?: null | string;
  deliveryAddress?: null | string;
  deliveryLatitude?: null | number;
  deliveryLongitude?: null | number;
  nationalId: string;
  reference: string;
}

export interface UserOrderHistoryFilters {
  createdFrom?: Date;
  createdTo?: Date;
  q?: string;
}

export async function adminSetOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
  changedByUserId: string,
  cancellationReason?: string,
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

    const trimmedReason = cancellationReason?.trim() ?? '';
    if (toStatus === 'cancelled' && trimmedReason.length < 3) {
      throw new OrderDomainError(
        'CANCELLATION_REASON_REQUIRED',
        'El motivo de cancelación es obligatorio',
        400,
      );
    }

    const result = await tx.order.updateMany({
      data: {
        ...(toStatus === 'cancelled' ? { cancellationReason: trimmedReason } : {}),
        ...(toStatus === 'paymentConfirmed' &&
        (order.exchangeRate === null || order.exchangeRate === undefined)
          ? { exchangeRate: new Prisma.Decimal(await getUsdVesRate()) }
          : {}),
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

    await appendOrderStatusHistory(tx, {
      changedByUserId,
      fromStatus: order.status,
      orderId,
      toStatus,
    });

    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return serializeOrder(updated);
  });
}

export async function assignOrderToDelivery(
  orderId: string,
  deliveryUserId: string,
  changedByUserId: string,
): Promise<OrderWithLines> {
  return client.$transaction(async (tx) => {
    const driver = await tx.user.findUnique({ where: { id: deliveryUserId } });
    if (!driver || driver.type !== 'deliveryDriver') {
      throw new OrderDomainError(
        'INVALID_DELIVERY_DRIVER',
        'El usuario indicado no es un repartidor válido',
        400,
      );
    }

    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    if (order.status !== 'readyForDelivery') {
      throw new OrderDomainError(
        'INVALID_STATUS_TRANSITION',
        'Solo se pueden asignar órdenes listas para reparto',
        400,
      );
    }
    if (!order.storeId || driver.storeId !== order.storeId) {
      throw new OrderDomainError(
        'DRIVER_STORE_MISMATCH',
        'El repartidor no pertenece a la sede de la orden',
        400,
      );
    }

    const busyCount = await tx.order.count({
      where: {
        deliveryUserId: driver.id,
        status: { in: ['assignedToDeliveryDriver', 'delivering'] },
      },
    });
    if (busyCount > 0) {
      throw new OrderDomainError('DRIVER_BUSY', 'El repartidor ya tiene una orden en curso', 409);
    }

    const result = await tx.order.updateMany({
      data: {
        deliveryUserId,
        status: 'assignedToDeliveryDriver',
        version: { increment: 1 },
      },
      where: {
        id: orderId,
        status: 'readyForDelivery',
      },
    });
    if (result.count === 0) {
      throw new OrderDomainError('ORDER_CONFLICT', 'El pedido cambió de forma concurrente', 409);
    }

    await appendOrderStatusHistory(tx, {
      changedByUserId,
      fromStatus: 'readyForDelivery',
      orderId,
      toStatus: 'assignedToDeliveryDriver',
    });

    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return serializeOrder(updated);
  });
}

export function buildKitchenOrdersWhere(
  filters: KitchenOrdersFilters = {},
): PrismaType.OrderWhereInput {
  const { createdFrom, createdTo, id, status = 'all', storeId } = filters;
  const dateRange =
    createdFrom || createdTo
      ? {
          ...(createdFrom ? { gte: startOfBusinessDayCaracas(createdFrom) } : {}),
          ...(createdTo ? { lt: startOfNextBusinessDayCaracas(createdTo) } : {}),
        }
      : null;
  return {
    ...(id ? { id: { contains: id } } : {}),
    ...(storeId ? { storeId } : {}),
    // "Todos" includes cancelled; unpaid carts (pending) stay out of the admin list.
    ...(status !== 'all' ? { status } : { status: { notIn: ['pending'] } }),
    // Match if either creation or payment falls in the selected period.
    ...(dateRange
      ? {
          OR: [{ createdAt: dateRange }, { paymentDate: dateRange }],
        }
      : {}),
  };
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

    const delivery = await resolveDeliverySnapshot(tx, userId, order.storeId);
    const updated = await tx.order.updateMany({
      data: {
        deliveryAddress: delivery.deliveryAddress,
        deliveryLatitude: delivery.deliveryLatitude,
        deliveryLongitude: delivery.deliveryLongitude,
        deliveryPhone: delivery.deliveryPhone,
        exchangeRate: new Prisma.Decimal(await getUsdVesRate()),
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

    await appendOrderStatusHistory(tx, {
      changedByUserId: userId,
      fromStatus: 'pending',
      orderId: order.id,
      toStatus: 'paymentConfirmed',
    });

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
    const methodConfig = await tx.paymentMethodConfig.findUnique({
      where: { method: details.method },
    });
    if (!methodConfig?.active) {
      throw new OrderDomainError(
        'PAYMENT_METHOD_INACTIVE',
        'El método de pago no está disponible',
        400,
      );
    }

    const trimmedNote = details.note?.trim() || null;
    if (trimmedNote && !methodConfig.noteEnabled) {
      throw new OrderDomainError(
        'PAYMENT_NOTE_NOT_ALLOWED',
        'Este método de pago no admite nota',
        400,
      );
    }
    if (trimmedNote && trimmedNote.length > 100) {
      throw new OrderDomainError(
        'PAYMENT_NOTE_TOO_LONG',
        'La nota no puede superar 100 caracteres',
        400,
      );
    }

    const trimmedCustomerNotes = details.customerNotes?.trim() || null;
    if (trimmedCustomerNotes && trimmedCustomerNotes.length > 280) {
      throw new OrderDomainError(
        'CUSTOMER_NOTES_TOO_LONG',
        'Las instrucciones de entrega no pueden superar 280 caracteres',
        400,
      );
    }

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
    const delivery = await resolveDeliverySnapshot(tx, userId, order.storeId);
    const updatedCount = await tx.order.updateMany({
      data: {
        customerNotes: trimmedCustomerNotes,
        deliveryAddress: delivery.deliveryAddress,
        deliveryLatitude: delivery.deliveryLatitude,
        deliveryLongitude: delivery.deliveryLongitude,
        deliveryPhone: delivery.deliveryPhone,
        exchangeRate: new Prisma.Decimal(await getUsdVesRate()),
        paidAt,
        paymentDate: details.paidAt ?? paidAt,
        paymentMethod: details.method,
        paymentReference: details.reference,
        paymentScreenshotUrl: details.screenshotUrl,
        status: 'paymentPendingConfirmation',
        version: { increment: 1 },
      },
      where: { id: order.id, status: 'pending', userId },
    });

    if (updatedCount.count === 0) {
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (!fresh) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
      if (fresh.status === 'paymentPendingConfirmation') {
        return { changes: [], order: serializeOrder(fresh) };
      }
      throw new OrderDomainError('ORDER_NOT_PENDING', 'El pedido no está pendiente', 409);
    }

    await appendOrderStatusHistory(tx, {
      changedByUserId: userId,
      fromStatus: 'pending',
      orderId: order.id,
      toStatus: 'paymentPendingConfirmation',
    });

    await tx.payment.upsert({
      create: {
        method: details.method,
        note: trimmedNote,
        orderId: order.id,
        paidAt,
        reference: details.reference ?? '',
        screenshotUrl: details.screenshotUrl,
      },
      update: {
        method: details.method,
        note: trimmedNote,
        paidAt,
        reference: details.reference ?? '',
        screenshotUrl: details.screenshotUrl,
      },
      where: { orderId: order.id },
    });

    const submitted = await tx.order.findUnique({ where: { id: order.id } });
    if (!submitted) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return { changes: reconciled.changes, order: serializeOrder(submitted) };
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
        route: '/mis-compras',
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

/** Escape `%`, `_`, and `\` for PostgreSQL ILIKE … ESCAPE '\\'. */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
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
  filters: UserOrderHistoryFilters = {},
): Promise<{
  data: OrderWithLines[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const skip = (page - 1) * pageSize;
  const qTrim = filters.q?.trim() ?? '';
  const paymentDateGte = filters.createdFrom
    ? startOfBusinessDayCaracas(filters.createdFrom)
    : undefined;
  const paymentDateLt = filters.createdTo
    ? startOfNextBusinessDayCaracas(filters.createdTo)
    : undefined;

  const baseWhere: PrismaType.OrderWhereInput = {
    status: { not: 'pending' },
    userId,
    ...(paymentDateGte || paymentDateLt
      ? {
          paymentDate: {
            ...(paymentDateGte ? { gte: paymentDateGte } : {}),
            ...(paymentDateLt ? { lt: paymentDateLt } : {}),
          },
        }
      : {}),
  };

  let data: Array<{ store: { name: string } | null } & Order>;
  let total: number;

  if (!qTrim) {
    const [rows, count] = await Promise.all([
      client.order.findMany({
        include: { store: { select: { name: true } } },
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        where: baseWhere,
      }),
      client.order.count({ where: baseWhere }),
    ]);
    data = rows;
    total = count;
  } else {
    const pattern = `%${escapeIlikePattern(qTrim)}%`;
    const historySearchWhereSql = `
      o."userId" = $1
      AND o.status <> 'pending'
      AND ($2::timestamptz IS NULL OR o."paymentDate" >= $2)
      AND ($3::timestamptz IS NULL OR o."paymentDate" < $3)
      AND (
        o.id::text ILIKE $4 ESCAPE '\\'
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(o.products::jsonb, '[]'::jsonb)) AS line
          WHERE COALESCE(line->>'name', '') ILIKE $4 ESCAPE '\\'
             OR COALESCE(line->>'description', '') ILIKE $4 ESCAPE '\\'
        )
      )
    `;
    const [idRows, countRows] = await Promise.all([
      client.$queryRawUnsafe<{ id: string }[]>(
        `SELECT o.id
         FROM "Order" o
         WHERE ${historySearchWhereSql}
         ORDER BY o."paymentDate" DESC NULLS LAST, o."createdAt" DESC
         LIMIT $5 OFFSET $6`,
        userId,
        paymentDateGte ?? null,
        paymentDateLt ?? null,
        pattern,
        pageSize,
        skip,
      ),
      client.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count
         FROM "Order" o
         WHERE ${historySearchWhereSql}`,
        userId,
        paymentDateGte ?? null,
        paymentDateLt ?? null,
        pattern,
      ),
    ]);
    total = Number(countRows[0]?.count ?? 0);
    const ids = idRows.map((row) => row.id);
    if (ids.length === 0) {
      data = [];
    } else {
      const rows = await client.order.findMany({
        include: { store: { select: { name: true } } },
        where: { id: { in: ids } },
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      data = ids
        .map((id) => byId.get(id))
        .filter((row): row is (typeof rows)[number] => row !== undefined);
    }
  }

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

export async function listDeliveryDriversForOrder(
  orderId: string,
): Promise<DeliveryDriverForAssign[]> {
  const order = await client.order.findUnique({
    select: { id: true, storeId: true },
    where: { id: orderId },
  });
  if (!order) {
    throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
  }
  if (!order.storeId) {
    return [];
  }

  const drivers = await client.user.findMany({
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: {
      email: true,
      firstName: true,
      id: true,
      lastName: true,
      storeId: true,
    },
    where: { storeId: order.storeId, type: 'deliveryDriver' },
  });

  if (drivers.length === 0) return [];

  const busyRows = await client.order.findMany({
    distinct: ['deliveryUserId'],
    select: { deliveryUserId: true },
    where: {
      deliveryUserId: { in: drivers.map((d) => d.id) },
      status: { in: ['assignedToDeliveryDriver', 'delivering'] },
    },
  });
  const busyIds = new Set(
    busyRows.map((row) => row.deliveryUserId).filter((id): id is string => Boolean(id)),
  );

  return drivers.map((driver) => ({
    busy: busyIds.has(driver.id),
    email: driver.email,
    firstName: driver.firstName,
    id: driver.id,
    lastName: driver.lastName,
    storeId: driver.storeId,
  }));
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
    status: { in: ['assignedToDeliveryDriver', 'delivering'] },
  };
  const [data, total] = await Promise.all([
    client.order.findMany({
      include: {
        user: { select: { address: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
      where,
    }),
    client.order.count({ where }),
  ]);
  return {
    data: data.map(({ user, ...order }) => serializeOrderWithDeliveryContact(order, user)),
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
  filters: KitchenOrdersFilters = {},
): Promise<{
  data: OrderWithUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const skip = (page - 1) * pageSize;
  const where = buildKitchenOrdersWhere(filters);
  const [data, total] = await Promise.all([
    client.order.findMany({
      include: {
        deliveryUser: { select: { firstName: true, lastName: true, phone: true } },
        payment: true,
        store: { select: { name: true } },
        user: { select: { address: true, numberId: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      where,
    }),
    client.order.count({ where }),
  ]);
  const serialized = data.map(({ user, ...order }) => ({
    ...serializeOrderWithDeliveryContact(order, user),
    deliveryUserName: order.deliveryUser
      ? `${order.deliveryUser.firstName} ${order.deliveryUser.lastName}`.trim()
      : null,
    deliveryUserPhone: order.deliveryUser?.phone ?? null,
    payment: order.payment ? serializePayment(order.payment) : null,
    storeName: order.store?.name ?? null,
    userNumberId: user.numberId,
  }));
  return {
    data: await enrichOrdersWithProductImages(serialized),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function listNotificationsForInbox(
  userId: string,
  recentRead: number,
): Promise<{
  data: Notification[];
  total: number;
  unreadCount: number;
}> {
  const [unread, read, unreadCount, total] = await Promise.all([
    client.notification.findMany({
      orderBy: { createdAt: 'desc' },
      where: { readAt: null, userId },
    }),
    recentRead > 0
      ? client.notification.findMany({
          orderBy: { createdAt: 'desc' },
          take: recentRead,
          where: { readAt: { not: null }, userId },
        })
      : Promise.resolve([]),
    client.notification.count({ where: { readAt: null, userId } }),
    client.notification.count({ where: { userId } }),
  ]);

  const data = [...unread, ...read].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );

  return { data, total, unreadCount };
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

export async function listOrderStatusHistory(orderId: string): Promise<
  Array<{
    cancellationReason: null | string;
    changedBy: {
      email: string;
      firstName: string;
      id: string;
      lastName: string;
      type: UserType;
    };
    createdAt: Date;
    deliveryProofUrl: null | string;
    fromStatus: OrderStatus;
    id: string;
    toStatus: OrderStatus;
  }>
> {
  const order = await client.order.findUnique({
    select: {
      cancellationReason: true,
      deliveryProofUrl: true,
    },
    where: { id: orderId },
  });
  if (!order) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);

  const rows = await client.orderStatusHistory.findMany({
    include: {
      changedBy: {
        select: { email: true, firstName: true, id: true, lastName: true, type: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    where: { orderId },
  });

  return rows.map((row) => ({
    cancellationReason: row.toStatus === 'cancelled' ? (order.cancellationReason ?? null) : null,
    changedBy: row.changedBy,
    createdAt: row.createdAt,
    deliveryProofUrl: row.toStatus === 'delivered' ? (order.deliveryProofUrl ?? null) : null,
    fromStatus: row.fromStatus,
    id: row.id,
    toStatus: row.toStatus,
  }));
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
  deliveryProofUrl: string,
): Promise<OrderWithLines> {
  if (!deliveryProofUrl.trim()) {
    throw new OrderDomainError('DELIVERY_PROOF_REQUIRED', 'La foto de entrega es obligatoria', 400);
  }

  if (actorType !== 'deliveryDriver') {
    throw new OrderDomainError(
      'FORBIDDEN',
      'Solo el repartidor asignado puede marcar la orden como entregada',
      403,
    );
  }

  const where: PrismaType.OrderWhereInput = {
    deliveryUserId: userId,
    id: orderId,
    status: 'delivering',
  };

  return client.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      data: {
        deliveryProofUrl,
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

    await appendOrderStatusHistory(tx, {
      changedByUserId: userId,
      fromStatus: 'delivering',
      orderId,
      toStatus: 'delivered',
    });

    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return serializeOrder(updated);
  });
}

/** Inbox + socket + FCM when a driver is assigned a delivery. */
export async function notifyDeliveryAssigned(
  order: OrderWithLines,
  deliveryUserId: string,
): Promise<void> {
  const title = 'Nuevo reparto';
  const body = `Se te asignó el pedido ${shortOrderRef(order.id)}`;
  await client.notification.create({
    data: {
      body,
      orderId: order.id,
      payload: {
        orderId: order.id,
        route: '/reparto',
        status: order.status,
      },
      title,
      type: 'DELIVERY_ASSIGNED',
      userId: deliveryUserId,
    },
  });
  emitUserNotification(deliveryUserId, {
    body,
    orderId: order.id,
    route: '/reparto',
    status: order.status,
    title,
    type: 'DELIVERY_ASSIGNED',
  });
  await sendPushToUser(deliveryUserId, {
    body,
    data: {
      orderId: order.id,
      route: '/reparto',
      type: 'DELIVERY_ASSIGNED',
    },
    title,
  });
}

/** Inbox + socket + FCM when a driver's assignment is cancelled / unassigned. */
export async function notifyDeliveryCancelled(
  orderId: string,
  deliveryUserId: string,
): Promise<void> {
  const title = 'Reparto cancelado';
  const body = `Se canceló o reasignó el pedido ${shortOrderRef(orderId)}`;
  await client.notification.create({
    data: {
      body,
      orderId,
      payload: {
        orderId,
        route: '/reparto',
      },
      title,
      type: 'DELIVERY_CANCELLED',
      userId: deliveryUserId,
    },
  });
  emitUserNotification(deliveryUserId, {
    body,
    orderId,
    route: '/reparto',
    title,
    type: 'DELIVERY_CANCELLED',
  });
  await sendPushToUser(deliveryUserId, {
    body,
    data: {
      orderId,
      route: '/reparto',
      type: 'DELIVERY_CANCELLED',
    },
    title,
  });
}

export async function notifyOrderPaid(
  order: OrderWithLines,
  previousStatus: OrderStatus = 'pending',
): Promise<void> {
  await notifyOrderStatusChange(order, previousStatus);
  emitOrderUpdated(order.userId, {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
  });
  emitKitchenNewPaid(order);
  await notifyStoreAdminsNewOrderEmail(order);
}

/** DB inbox + socket + FCM for the order owner (client). */
export async function notifyOrderStatusChange(
  order: OrderWithLines,
  previousStatus: OrderStatus,
): Promise<void> {
  await createOrderStatusNotification(order, previousStatus);
  const body = formatOrderStatusChangeBody(previousStatus, order.status);
  const title = 'Actualización de orden';
  emitUserNotification(order.userId, {
    body,
    newStatus: order.status,
    orderId: order.id,
    previousStatus,
    route: '/mis-compras',
    status: order.status,
    title,
    type: 'ORDER_STATUS_CHANGED',
  });
  await sendPushToUser(order.userId, {
    body,
    data: {
      newStatus: String(order.status),
      orderId: order.id,
      previousStatus: String(previousStatus),
      route: '/mis-compras',
      type: 'ORDER_STATUS_CHANGED',
    },
    title,
  });
}

/** Email store admins when an order reaches paymentPendingConfirmation or paymentConfirmed. */
export async function notifyStoreAdminsNewOrderEmail(order: {
  id: string;
  status: OrderStatus;
  storeId: null | string;
}): Promise<void> {
  if (order.status !== 'paymentPendingConfirmation' && order.status !== 'paymentConfirmed') {
    return;
  }
  if (!order.storeId) {
    return;
  }

  try {
    const admins = await client.user.findMany({
      select: { email: true, firstName: true },
      where: { storeId: order.storeId, type: 'admin' },
    });
    if (admins.length === 0) {
      return;
    }

    const shortOrderId = formatShortOrderId(order.id);
    const statusLabel = formatOrderStatusLabel(order.status);
    const results = await Promise.allSettled(
      admins.map((admin) =>
        sendNewOrderForAdminEmail({
          email: admin.email,
          firstName: admin.firstName,
          shortOrderId,
          statusLabel,
        }),
      ),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[orders] failed to send new-order admin email', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          orderId: order.id,
        });
      }
    }
  } catch (err) {
    console.error('[orders] failed to notify store admins of new order', {
      error: err instanceof Error ? err.message : String(err),
      orderId: order.id,
    });
  }
}

export async function startOrderDelivering(
  actorType: UserType,
  orderId: string,
  actorUserId: string,
): Promise<OrderWithLines> {
  if (actorType !== 'deliveryDriver') {
    throw new OrderDomainError(
      'FORBIDDEN',
      'Solo el repartidor asignado puede iniciar el reparto desde la app',
      403,
    );
  }

  return client.$transaction(async (tx) => {
    const activeCount = await tx.order.count({
      where: {
        deliveryUserId: actorUserId,
        status: 'delivering',
      },
    });
    if (activeCount > 0) {
      throw new OrderDomainError(
        'ACTIVE_DELIVERY_EXISTS',
        'Ya tienes un reparto activo. Finalízalo antes de iniciar otro',
        409,
      );
    }

    const where: PrismaType.OrderWhereInput = {
      deliveryUserId: actorUserId,
      id: orderId,
      status: 'assignedToDeliveryDriver',
    };

    const result = await tx.order.updateMany({
      data: {
        status: 'delivering',
        version: { increment: 1 },
      },
      where,
    });
    if (result.count === 0) {
      throw new OrderDomainError(
        'ORDER_NOT_ASSIGNED',
        'El pedido no está asignado o no pertenece a este repartidor',
        409,
      );
    }

    await appendOrderStatusHistory(tx, {
      changedByUserId: actorUserId,
      fromStatus: 'assignedToDeliveryDriver',
      orderId,
      toStatus: 'delivering',
    });

    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return serializeOrder(updated);
  });
}

export async function unassignOrderFromDelivery(
  orderId: string,
  changedByUserId: string,
): Promise<OrderWithLines> {
  return client.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    if (order.status !== 'assignedToDeliveryDriver') {
      throw new OrderDomainError(
        'INVALID_STATUS_TRANSITION',
        'Solo se puede rechazar la asignación mientras la orden está asignada al repartidor',
        400,
      );
    }

    const result = await tx.order.updateMany({
      data: {
        deliveryUserId: null,
        status: 'readyForDelivery',
        version: { increment: 1 },
      },
      where: {
        id: orderId,
        status: 'assignedToDeliveryDriver',
      },
    });
    if (result.count === 0) {
      throw new OrderDomainError('ORDER_CONFLICT', 'El pedido cambió de forma concurrente', 409);
    }

    await appendOrderStatusHistory(tx, {
      changedByUserId,
      fromStatus: 'assignedToDeliveryDriver',
      orderId,
      toStatus: 'readyForDelivery',
    });

    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
    return serializeOrder(updated);
  });
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
  const methodConfig = await client.paymentMethodConfig.findUnique({
    where: { method: 'mobilePayment' },
  });
  if (!methodConfig?.active) {
    throw new OrderDomainError(
      'PAYMENT_METHOD_INACTIVE',
      'El método de pago no está disponible',
      400,
    );
  }

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
  const usdRate = await getUsdVesRate();
  const amount = await resolveMegasoftAmount(orderAmount);

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
    const delivery = await resolveDeliverySnapshot(tx, userId, order.storeId);
    const trimmedCustomerNotes = details.customerNotes?.trim() || null;
    if (trimmedCustomerNotes && trimmedCustomerNotes.length > 280) {
      throw new OrderDomainError(
        'CUSTOMER_NOTES_TOO_LONG',
        'Las instrucciones de entrega no pueden superar 280 caracteres',
        400,
      );
    }
    const updated = await tx.order.updateMany({
      data: {
        customerNotes: trimmedCustomerNotes,
        deliveryAddress: delivery.deliveryAddress,
        deliveryLatitude: delivery.deliveryLatitude,
        deliveryLongitude: delivery.deliveryLongitude,
        deliveryPhone: delivery.deliveryPhone,
        exchangeRate: new Prisma.Decimal(usdRate),
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

    await appendOrderStatusHistory(tx, {
      changedByUserId: userId,
      fromStatus: 'pending',
      orderId: order.id,
      toStatus: 'paymentConfirmed',
    });

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
    if (order.status !== 'paymentPendingConfirmation') {
      throw new OrderDomainError(
        'INVALID_STATUS_TRANSITION',
        'El pedido no está en pago por confirmar',
        400,
      );
    }

    if (verify) {
      const updated = await tx.order.update({
        data: {
          exchangeRate: new Prisma.Decimal(await getUsdVesRate()),
          status: 'paymentConfirmed',
          version: { increment: 1 },
        },
        where: { id: orderId, status: 'paymentPendingConfirmation' },
      });

      await appendOrderStatusHistory(tx, {
        changedByUserId: adminUserId,
        fromStatus: 'paymentPendingConfirmation',
        orderId,
        toStatus: 'paymentConfirmed',
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

  const store = await tx.store.findFirst({
    where: { active: true, id: storeId },
  });
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

function formatShortOrderId(orderId: string): string {
  const segment = orderId.split('-')[0]?.trim() || orderId.trim();
  return `#${segment}`;
}

function shortOrderRef(orderId: string): string {
  const segment = orderId.split('-')[0]?.trim() || orderId.trim();
  return `#${segment}`;
}

const CANCELLABLE_STATUSES: OrderStatus[] = [
  'pending',
  'paymentPendingConfirmation',
  'paymentConfirmed',
  'preparing',
  'readyForDelivery',
  'assignedToDeliveryDriver',
  'delivering',
];

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

export function canTransitionByAdmin(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'cancelled') return CANCELLABLE_STATUSES.includes(from);
  if (from === 'paymentConfirmed' && to === 'preparing') return true;
  if (from === 'preparing' && to === 'readyForDelivery') return true;
  return false;
}

export function computeTotal(lines: OrderLine[]): number {
  return Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
}

export function mergeInputsByCode(inputs: CartLineInput[]): CartLineInput[] {
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

async function appendOrderStatusHistory(
  tx: Prisma.TransactionClient,
  params: {
    changedByUserId: string;
    fromStatus: OrderStatus;
    orderId: string;
    toStatus: OrderStatus;
  },
): Promise<void> {
  await tx.orderStatusHistory.create({
    data: {
      changedByUserId: params.changedByUserId,
      fromStatus: params.fromStatus,
      orderId: params.orderId,
      toStatus: params.toStatus,
    },
  });
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

async function resolveDeliverySnapshot(
  tx: Pick<Prisma.TransactionClient, 'store' | 'user'>,
  userId: string,
  storeId: null | string,
  _deliveryAddress?: null | string,
  _deliveryLatitude?: null | number,
  _deliveryLongitude?: null | number,
): Promise<{
  deliveryAddress: null | string;
  deliveryLatitude: null | Prisma.Decimal;
  deliveryLongitude: null | Prisma.Decimal;
  deliveryPhone: null | string;
}> {
  const user = await tx.user.findUnique({
    select: {
      address: true,
      addressCity: true,
      addressLatitude: true,
      addressLongitude: true,
      phone: true,
    },
    where: { id: userId },
  });

  const profileLat =
    user?.addressLatitude === null || user?.addressLatitude === undefined
      ? null
      : Number(user.addressLatitude.toString());
  const profileLng =
    user?.addressLongitude === null || user?.addressLongitude === undefined
      ? null
      : Number(user.addressLongitude.toString());
  const profileCity = user?.addressCity?.trim() || null;
  const profileAddress = user?.address?.trim() || null;

  if (
    profileLat === null ||
    profileLng === null ||
    !profileCity ||
    !profileAddress ||
    !Number.isFinite(profileLat) ||
    !Number.isFinite(profileLng)
  ) {
    throw new OrderDomainError(
      'ADDRESS_REQUIRED',
      'Configura tu dirección en el mapa antes de pagar',
      409,
    );
  }

  if (storeId) {
    const store = await tx.store.findUnique({
      select: { city: true, name: true },
      where: { id: storeId },
    });
    const storeCity = store?.city?.trim() || null;
    if (!storeCity) {
      throw new OrderDomainError(
        'STORE_CITY_MISSING',
        'La tienda no tiene ciudad configurada',
        500,
      );
    }
    if (profileCity !== storeCity) {
      throw new OrderDomainError(
        'ADDRESS_CITY_MISMATCH',
        `Elige una nueva dirección en la misma ciudad de ${store?.name ?? 'la tienda'}`,
        409,
        { storeCity, storeName: store?.name ?? null, userCity: profileCity },
      );
    }
  }

  return {
    deliveryAddress: profileAddress,
    deliveryLatitude: new Prisma.Decimal(profileLat.toFixed(7)),
    deliveryLongitude: new Prisma.Decimal(profileLng.toFixed(7)),
    deliveryPhone: user?.phone?.trim() || null,
  };
}

async function resolveEffectiveStoreId(
  tx: Prisma.TransactionClient,
  storeId: null | string,
): Promise<null | string> {
  if (storeId) return storeId;
  const stores = await tx.store.findMany({
    select: { id: true },
    take: 2,
    where: { active: true },
  });
  return stores.length === 1 ? stores[0].id : null;
}

function serializeOrder(order: Order): OrderWithLines {
  const exchangeRate =
    order.exchangeRate === null || order.exchangeRate === undefined
      ? null
      : Number(order.exchangeRate.toString());
  const totalAmount = Number(order.totalAmount.toString());
  const deliveryLatitude =
    order.deliveryLatitude === null || order.deliveryLatitude === undefined
      ? null
      : Number(order.deliveryLatitude.toString());
  const deliveryLongitude =
    order.deliveryLongitude === null || order.deliveryLongitude === undefined
      ? null
      : Number(order.deliveryLongitude.toString());
  return {
    ...order,
    deliveryLatitude,
    deliveryLongitude,
    exchangeRate,
    products: toOrderLines(order.products as Prisma.JsonValue),
    totalAmount,
    totalAmountBs: exchangeRate === null ? null : Number((totalAmount * exchangeRate).toFixed(2)),
  };
}

function serializeOrderWithDeliveryContact(
  order: Order,
  user?: { address: null | string; phone: null | string } | null,
): OrderWithLines {
  const serialized = serializeOrder(order);
  return {
    ...serialized,
    deliveryAddress: serialized.deliveryAddress ?? user?.address ?? null,
    deliveryPhone: serialized.deliveryPhone ?? user?.phone ?? null,
  };
}

function serializePayment(payment: Payment): SerializedPayment {
  return {
    createdAt: payment.createdAt,
    id: payment.id,
    method: payment.method,
    note: payment.note ?? null,
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
