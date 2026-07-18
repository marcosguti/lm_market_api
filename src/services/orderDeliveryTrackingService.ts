import type { Order, OrderDeliveryTracking, UserType } from '@prisma/client';

import { Prisma, PrismaClient } from '@prisma/client';

import { getTrackingConfig } from '../config/tracking.js';
import { fetchDrivingRoute, MapboxDirectionsError } from '../libs/mapboxDirections.js';
import prisma from '../prisma.js';
import { emitTrackingEnded, emitTrackingLocation, emitTrackingRoute } from '../realtime/socket.js';
import { OrderDomainError } from './orderService.js';

const client = prisma as PrismaClient;

export interface DeliveryLocationInput {
  accuracyMeters?: null | number;
  deviceId?: null | string;
  deviceRecordedAt?: Date | null;
  headingDegrees?: null | number;
  latitude: number;
  longitude: number;
  speedMps?: null | number;
  trackingSessionId?: null | string;
}

export interface DeliveryTrackingSnapshot {
  destination: {
    address: null | string;
    latitude: number;
    longitude: number;
  } | null;
  distanceMeters: null | number;
  etaSeconds: null | number;
  isStale: boolean;
  location: {
    accuracyMeters: null | number;
    headingDegrees: null | number;
    latitude: number;
    longitude: number;
    serverReceivedAt: string;
    speedMps: null | number;
  } | null;
  orderId: string;
  routeCalculatedAt: null | string;
  routeGeometry: {
    coordinates: [number, number][];
    type: 'LineString';
  } | null;
  staleAfterSeconds: number;
  status: Order['status'];
}

export async function assertCanSubscribeTracking(
  actorType: UserType,
  actorUserId: string,
  orderId: string,
): Promise<void> {
  await assertCanReadTracking(actorType, actorUserId, orderId);
}

export async function clearDeliveryTracking(orderId: string): Promise<void> {
  await client.orderDeliveryTracking.deleteMany({ where: { orderId } });
}

export async function endDeliveryTrackingAndNotify(params: {
  clientUserId: string;
  deliveryUserId?: null | string;
  orderId: string;
  reason: 'cancelled' | 'delivered';
}): Promise<void> {
  await clearDeliveryTracking(params.orderId);
  emitTrackingEnded(
    {
      orderId: params.orderId,
      reason: params.reason,
    },
    {
      adminRoom: true,
      userIds: [params.clientUserId, params.deliveryUserId].filter((id): id is string =>
        Boolean(id),
      ),
    },
  );
}

export async function getDeliveryTrackingSnapshot(
  actorType: UserType,
  actorUserId: string,
  orderId: string,
): Promise<DeliveryTrackingSnapshot> {
  const order = await assertCanReadTracking(actorType, actorUserId, orderId);
  const tracking = await client.orderDeliveryTracking.findUnique({ where: { orderId } });
  return serializeTracking(order, tracking);
}

export async function upsertDeliveryLocation(
  actorUserId: string,
  orderId: string,
  input: DeliveryLocationInput,
): Promise<DeliveryTrackingSnapshot> {
  const config = getTrackingConfig();

  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    throw new OrderDomainError('INVALID_COORDINATES', 'Coordenadas inválidas', 400);
  }

  if (
    input.accuracyMeters !== null &&
    input.accuracyMeters !== undefined &&
    input.accuracyMeters > config.maxAccuracyMeters
  ) {
    throw new OrderDomainError(
      'LOCATION_TOO_INACCURATE',
      'La precisión del GPS es insuficiente',
      400,
    );
  }

  const order = await client.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
  }
  if (order.status !== 'delivering' || order.deliveryUserId !== actorUserId) {
    throw new OrderDomainError(
      'ORDER_NOT_IN_DELIVERY',
      'El pedido no está en reparto o no está asignado a este conductor',
      409,
    );
  }

  const previous = await client.orderDeliveryTracking.findUnique({ where: { orderId } });
  if (previous) {
    const elapsedMs = Date.now() - previous.serverReceivedAt.getTime();
    if (elapsedMs < config.locationIntervalSeconds * 1000) {
      throw new OrderDomainError(
        'LOCATION_RATE_LIMITED',
        'Actualización de ubicación demasiado frecuente',
        429,
      );
    }
    const previousSession = previous.trackingSessionId?.trim() || null;
    const incomingSession = input.trackingSessionId?.trim() || null;
    if (previousSession) {
      if (!incomingSession || incomingSession !== previousSession) {
        throw new OrderDomainError(
          'TRACKING_SESSION_CONFLICT',
          'Otra sesión está transmitiendo la ubicación de este reparto',
          409,
        );
      }
    }
  }

  const now = new Date();
  const tracking = await client.orderDeliveryTracking.upsert({
    create: {
      accuracyMeters: input.accuracyMeters ?? null,
      deviceId: input.deviceId ?? null,
      deviceRecordedAt: input.deviceRecordedAt ?? null,
      headingDegrees: input.headingDegrees ?? null,
      latitude: new Prisma.Decimal(input.latitude.toFixed(7)),
      longitude: new Prisma.Decimal(input.longitude.toFixed(7)),
      orderId,
      serverReceivedAt: now,
      speedMps: input.speedMps ?? null,
      trackingSessionId: input.trackingSessionId ?? null,
    },
    update: {
      accuracyMeters: input.accuracyMeters ?? null,
      deviceId: input.deviceId ?? null,
      deviceRecordedAt: input.deviceRecordedAt ?? null,
      headingDegrees: input.headingDegrees ?? null,
      latitude: new Prisma.Decimal(input.latitude.toFixed(7)),
      longitude: new Prisma.Decimal(input.longitude.toFixed(7)),
      serverReceivedAt: now,
      speedMps: input.speedMps ?? null,
      trackingSessionId: input.trackingSessionId ?? previous?.trackingSessionId ?? null,
    },
    where: { orderId },
  });

  const withRoute = await maybeRefreshRoute({ order, previous, tracking });
  const snapshot = serializeTracking(order, withRoute);

  emitTrackingLocation(order.userId, {
    location: {
      accuracyMeters: snapshot.location?.accuracyMeters ?? null,
      headingDegrees: snapshot.location?.headingDegrees ?? null,
      latitude: snapshot.location!.latitude,
      longitude: snapshot.location!.longitude,
      serverReceivedAt: snapshot.location!.serverReceivedAt,
      speedMps: snapshot.location?.speedMps ?? null,
    },
    orderId: order.id,
  });

  return snapshot;
}

function asNumber(value: null | number | Prisma.Decimal | undefined): null | number {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value.toString());
}

async function assertCanReadTracking(
  actorType: UserType,
  actorUserId: string,
  orderId: string,
): Promise<Order> {
  const order = await client.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404);
  }
  if (order.status !== 'delivering') {
    throw new OrderDomainError(
      'TRACKING_NOT_ACTIVE',
      'El seguimiento solo está disponible mientras la orden está en reparto',
      409,
    );
  }
  if (actorType === 'admin' || actorType === 'superAdmin') return order;
  if (actorType === 'client' && order.userId === actorUserId) return order;
  throw new OrderDomainError(
    'FORBIDDEN',
    'No tienes permiso para ver el seguimiento de este pedido',
    403,
  );
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

async function maybeRefreshRoute(params: {
  order: Order;
  previous: null | OrderDeliveryTracking;
  tracking: OrderDeliveryTracking;
}): Promise<OrderDeliveryTracking> {
  const config = getTrackingConfig();
  const destinationLat = asNumber(params.order.deliveryLatitude);
  const destinationLng = asNumber(params.order.deliveryLongitude);
  if (destinationLat === null || destinationLng === null) return params.tracking;

  const currentLat = Number(params.tracking.latitude.toString());
  const currentLng = Number(params.tracking.longitude.toString());
  const previousLat = params.previous ? Number(params.previous.latitude.toString()) : null;
  const previousLng = params.previous ? Number(params.previous.longitude.toString()) : null;

  const movedMeters =
    previousLat === null || previousLng === null
      ? Number.POSITIVE_INFINITY
      : haversineMeters(previousLat, previousLng, currentLat, currentLng);
  const ageMs = params.previous?.routeCalculatedAt
    ? Date.now() - params.previous.routeCalculatedAt.getTime()
    : Number.POSITIVE_INFINITY;
  const shouldRefresh =
    !params.previous?.routeGeometry ||
    ageMs >= config.routeRefreshSeconds * 1000 ||
    movedMeters >= config.routeRefreshDistanceMeters;

  if (!shouldRefresh) return params.tracking;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const route = await fetchDrivingRoute({
      destinationLat,
      destinationLng,
      originLat: currentLat,
      originLng: currentLng,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const updated = await client.orderDeliveryTracking.update({
      data: {
        distanceMeters: route.distanceMeters,
        etaSeconds: route.durationSeconds,
        routeCalculatedAt: new Date(),
        routeGeometry: route.geometry as unknown as Prisma.InputJsonValue,
      },
      where: { orderId: params.order.id },
    });

    emitTrackingRoute(params.order.userId, {
      distanceMeters: updated.distanceMeters,
      etaSeconds: updated.etaSeconds,
      orderId: params.order.id,
      routeCalculatedAt: updated.routeCalculatedAt?.toISOString() ?? null,
      routeGeometry: parseRouteGeometry(updated.routeGeometry),
    });

    return updated;
  } catch (error) {
    if (!(error instanceof MapboxDirectionsError) && !(error instanceof Error)) {
      throw error;
    }
    // Degrade gracefully: live location continues without ETA/route.
    return params.tracking;
  }
}

function parseRouteGeometry(value: null | Prisma.JsonValue): {
  coordinates: [number, number][];
  type: 'LineString';
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const geometry = value as { coordinates?: unknown; type?: unknown };
  if (geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
  const coordinates = geometry.coordinates.filter(
    (point): point is [number, number] =>
      Array.isArray(point) &&
      point.length === 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number',
  );
  if (coordinates.length < 2) return null;
  return { coordinates, type: 'LineString' };
}

function serializeTracking(
  order: Pick<
    Order,
    'deliveryAddress' | 'deliveryLatitude' | 'deliveryLongitude' | 'id' | 'status'
  >,
  tracking: null | OrderDeliveryTracking,
): DeliveryTrackingSnapshot {
  const config = getTrackingConfig();
  const serverReceivedAt = tracking?.serverReceivedAt ?? null;
  const ageMs = serverReceivedAt ? Date.now() - serverReceivedAt.getTime() : null;
  const isStale = ageMs === null ? true : ageMs > config.staleAfterSeconds * 1000;
  const destinationLat = asNumber(order.deliveryLatitude);
  const destinationLng = asNumber(order.deliveryLongitude);

  return {
    destination:
      destinationLat === null || destinationLng === null
        ? null
        : {
            address: order.deliveryAddress ?? null,
            latitude: destinationLat,
            longitude: destinationLng,
          },
    distanceMeters: tracking?.distanceMeters ?? null,
    etaSeconds: tracking?.etaSeconds ?? null,
    isStale,
    location: tracking
      ? {
          accuracyMeters: tracking.accuracyMeters ?? null,
          headingDegrees: tracking.headingDegrees ?? null,
          latitude: Number(tracking.latitude.toString()),
          longitude: Number(tracking.longitude.toString()),
          serverReceivedAt: tracking.serverReceivedAt.toISOString(),
          speedMps: tracking.speedMps ?? null,
        }
      : null,
    orderId: order.id,
    routeCalculatedAt: tracking?.routeCalculatedAt?.toISOString() ?? null,
    routeGeometry: parseRouteGeometry(tracking?.routeGeometry ?? null),
    staleAfterSeconds: config.staleAfterSeconds,
    status: order.status,
  };
}
