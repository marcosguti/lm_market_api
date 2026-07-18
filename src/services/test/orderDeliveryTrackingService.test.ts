import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../prisma.js', () => ({
  default: {
    order: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    orderDeliveryTracking: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../../realtime/socket.js', () => ({
  emitTrackingEnded: vi.fn(),
  emitTrackingLocation: vi.fn(),
  emitTrackingRoute: vi.fn(),
}));

vi.mock('../../libs/mapboxDirections.js', () => ({
  MapboxDirectionsError: class MapboxDirectionsError extends Error {},
  fetchDrivingRoute: vi.fn(),
}));

vi.mock('../../config/tracking.js', () => ({
  getTrackingConfig: () => ({
    locationIntervalSeconds: 5,
    maxAccuracyMeters: 100,
    routeRefreshDistanceMeters: 150,
    routeRefreshSeconds: 60,
    staleAfterSeconds: 45,
  }),
}));

import { Prisma } from '@prisma/client';

import { fetchDrivingRoute } from '../../libs/mapboxDirections.js';
import prisma from '../../prisma.js';
import { emitTrackingLocation } from '../../realtime/socket.js';
import {
  getDeliveryTrackingSnapshot,
  upsertDeliveryLocation,
} from '../orderDeliveryTrackingService.js';

const prismaMock = prisma as unknown as {
  order: { count: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  orderDeliveryTracking: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

describe('orderDeliveryTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects location updates when order is not delivering for the driver', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      deliveryUserId: 'other-driver',
      id: 'o1',
      status: 'delivering',
      userId: 'c1',
    });

    await expect(
      upsertDeliveryLocation('driver-1', 'o1', { latitude: 10.5, longitude: -66.9 }),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_IN_DELIVERY', statusCode: 409 });
  });

  it('upserts location and emits tracking:location', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      deliveryAddress: 'Calle 1',
      deliveryLatitude: new Prisma.Decimal('10.4800000'),
      deliveryLongitude: new Prisma.Decimal('-66.9000000'),
      deliveryUserId: 'driver-1',
      id: 'o1',
      status: 'delivering',
      userId: 'c1',
    });
    prismaMock.orderDeliveryTracking.findUnique.mockResolvedValue(null);
    const trackingRow = {
      accuracyMeters: 12,
      deviceId: 'd1',
      deviceRecordedAt: null,
      distanceMeters: null,
      etaSeconds: null,
      headingDegrees: null,
      latitude: new Prisma.Decimal('10.4900000'),
      longitude: new Prisma.Decimal('-66.9100000'),
      orderId: 'o1',
      routeCalculatedAt: null,
      routeGeometry: null,
      serverReceivedAt: new Date(),
      speedMps: null,
      trackingSessionId: 'session-1',
    };
    prismaMock.orderDeliveryTracking.upsert.mockResolvedValue(trackingRow);
    vi.mocked(fetchDrivingRoute).mockResolvedValue({
      distanceMeters: 1200,
      durationSeconds: 420,
      geometry: {
        coordinates: [
          [-66.91, 10.49],
          [-66.9, 10.48],
        ],
        type: 'LineString',
      },
    });
    prismaMock.orderDeliveryTracking.update.mockResolvedValue({
      ...trackingRow,
      distanceMeters: 1200,
      etaSeconds: 420,
      routeCalculatedAt: new Date(),
      routeGeometry: {
        coordinates: [
          [-66.91, 10.49],
          [-66.9, 10.48],
        ],
        type: 'LineString',
      },
    });

    const snapshot = await upsertDeliveryLocation('driver-1', 'o1', {
      latitude: 10.49,
      longitude: -66.91,
      trackingSessionId: 'session-1',
    });

    expect(emitTrackingLocation).toHaveBeenCalled();
    expect(snapshot.location?.latitude).toBeCloseTo(10.49);
    expect(snapshot.destination?.latitude).toBeCloseTo(10.48);
  });

  it('rejects location updates when trackingSessionId conflicts or is missing', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      deliveryAddress: 'Calle 1',
      deliveryLatitude: new Prisma.Decimal('10.4800000'),
      deliveryLongitude: new Prisma.Decimal('-66.9000000'),
      deliveryUserId: 'driver-1',
      id: 'o1',
      status: 'delivering',
      userId: 'c1',
    });
    prismaMock.orderDeliveryTracking.findUnique.mockResolvedValue({
      accuracyMeters: null,
      deviceId: null,
      deviceRecordedAt: null,
      distanceMeters: null,
      etaSeconds: null,
      headingDegrees: null,
      latitude: new Prisma.Decimal('10.4900000'),
      longitude: new Prisma.Decimal('-66.9100000'),
      orderId: 'o1',
      routeCalculatedAt: null,
      routeGeometry: null,
      serverReceivedAt: new Date(Date.now() - 10_000),
      speedMps: null,
      trackingSessionId: 'session-1',
    });

    await expect(
      upsertDeliveryLocation('driver-1', 'o1', {
        latitude: 10.491,
        longitude: -66.911,
      }),
    ).rejects.toMatchObject({ code: 'TRACKING_SESSION_CONFLICT', statusCode: 409 });

    await expect(
      upsertDeliveryLocation('driver-1', 'o1', {
        latitude: 10.491,
        longitude: -66.911,
        trackingSessionId: 'other-session',
      }),
    ).rejects.toMatchObject({ code: 'TRACKING_SESSION_CONFLICT', statusCode: 409 });
  });

  it('allows client owner to read tracking only while delivering', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      deliveryAddress: 'Calle 1',
      deliveryLatitude: new Prisma.Decimal('10.4800000'),
      deliveryLongitude: new Prisma.Decimal('-66.9000000'),
      id: 'o1',
      status: 'delivering',
      userId: 'c1',
    });
    prismaMock.orderDeliveryTracking.findUnique.mockResolvedValue(null);

    const snapshot = await getDeliveryTrackingSnapshot('client', 'c1', 'o1');
    expect(snapshot.orderId).toBe('o1');
    expect(snapshot.location).toBeNull();
  });
});
