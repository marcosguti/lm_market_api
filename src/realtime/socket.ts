import type { UserType } from '@prisma/client';
import type { Server as HttpServer } from 'http';

import { Server, type Socket } from 'socket.io';

import { isCorsOriginAllowed } from '../libs/corsOrigins.js';
import { verifyToken } from '../libs/jwt.js';
import { findUserById } from '../queries/user.js';

export const KITCHEN_ROOM = 'orders:kitchen';

export interface SocketAuthUser {
  type: UserType;
  userId: string;
}

let io: null | Server = null;

export function createSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      credentials: true,
      origin: (origin, callback) => {
        if (isCorsOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
    },
  });

  io.use(async (socket, next) => {
    const token = resolveTokenFromHandshake(socket);
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }
    try {
      const payload = verifyToken(token);
      const user = await findUserById(payload.userId);
      if (!user) {
        next(new Error('Unauthorized'));
        return;
      }
      (socket.data as SocketAuthUser).userId = user.id;
      (socket.data as SocketAuthUser).type = user.type;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const authUser = socket.data as SocketAuthUser;
    socket.join(`user:${authUser.userId}`);
    if (authUser.type === 'admin' || authUser.type === 'superAdmin') {
      socket.join(KITCHEN_ROOM);
    }

    socket.on('tracking:subscribe', async (payload: unknown, ack?: (response: unknown) => void) => {
      try {
        const orderId =
          payload && typeof payload === 'object' && 'orderId' in payload
            ? String((payload as { orderId?: unknown }).orderId ?? '')
            : '';
        if (!orderId) {
          ack?.({ error: 'orderId requerido', ok: false });
          return;
        }
        const { assertCanSubscribeTracking } =
          await import('../services/orderDeliveryTrackingService.js');
        await assertCanSubscribeTracking(authUser.type, authUser.userId, orderId);
        await socket.join(trackingRoom(orderId));
        ack?.({ ok: true, orderId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo suscribir';
        ack?.({ error: message, ok: false });
      }
    });

    socket.on(
      'tracking:unsubscribe',
      async (payload: unknown, ack?: (response: unknown) => void) => {
        const orderId =
          payload && typeof payload === 'object' && 'orderId' in payload
            ? String((payload as { orderId?: unknown }).orderId ?? '')
            : '';
        if (orderId) {
          await socket.leave(trackingRoom(orderId));
        }
        ack?.({ ok: true });
      },
    );
  });

  return io;
}

export function emitDeliveryOrderCancelled(
  deliveryUserId: null | string,
  payload: { orderId: string },
): void {
  if (!deliveryUserId) return;
  requireIO().to(`user:${deliveryUserId}`).emit('order:cancelled', payload);
}

export function emitKitchenNewPaid(payload: unknown): void {
  requireIO().to(KITCHEN_ROOM).emit('order:newPaid', payload);
}

export function emitKitchenOrderUpdated(payload: unknown): void {
  requireIO().to(KITCHEN_ROOM).emit('order:updated', payload);
}

export function emitOrderCancelled(payload: { orderId: string }): void {
  requireIO().to(KITCHEN_ROOM).emit('order:cancelled', payload);
}

export function emitOrderUpdated(userId: string, payload: unknown): void {
  requireIO().to(`user:${userId}`).emit('order:updated', payload);
}

export function emitTrackingEnded(
  payload: { orderId: string; reason: 'cancelled' | 'delivered' },
  targets: { adminRoom?: boolean; userIds: string[] },
): void {
  const server = requireIO();
  for (const userId of targets.userIds) {
    server.to(`user:${userId}`).emit('tracking:ended', payload);
  }
  if (targets.adminRoom) {
    server.to(KITCHEN_ROOM).emit('tracking:ended', payload);
  }
  server.to(trackingRoom(payload.orderId)).emit('tracking:ended', payload);
}

export function emitTrackingLocation(
  clientUserId: string,
  payload: {
    location: {
      accuracyMeters: null | number;
      headingDegrees: null | number;
      latitude: number;
      longitude: number;
      serverReceivedAt: string;
      speedMps: null | number;
    };
    orderId: string;
  },
): void {
  const server = requireIO();
  server.to(`user:${clientUserId}`).emit('tracking:location', payload);
  server.to(KITCHEN_ROOM).emit('tracking:location', payload);
  server.to(trackingRoom(payload.orderId)).emit('tracking:location', payload);
}

export function emitTrackingRoute(
  clientUserId: string,
  payload: {
    distanceMeters: null | number;
    etaSeconds: null | number;
    orderId: string;
    routeCalculatedAt: null | string;
    routeGeometry: { coordinates: [number, number][]; type: 'LineString' } | null;
  },
): void {
  const server = requireIO();
  server.to(`user:${clientUserId}`).emit('tracking:route', payload);
  server.to(KITCHEN_ROOM).emit('tracking:route', payload);
  server.to(trackingRoom(payload.orderId)).emit('tracking:route', payload);
}

export function emitUserNotification(userId: string, payload: unknown): void {
  requireIO().to(`user:${userId}`).emit('notification:new', payload);
}

export function trackingRoom(orderId: string): string {
  return `tracking:${orderId}`;
}

function requireIO(): Server {
  if (!io) {
    throw new Error('Socket server not initialized');
  }
  return io;
}

function resolveTokenFromHandshake(socket: Socket): null | string {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();
  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();
  return null;
}
