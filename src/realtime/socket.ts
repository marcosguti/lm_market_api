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

export function emitOrderCancelled(payload: { orderId: string }): void {
  requireIO().to(KITCHEN_ROOM).emit('order:cancelled', payload);
}

export function emitOrderUpdated(userId: string, payload: unknown): void {
  requireIO().to(`user:${userId}`).emit('order:updated', payload);
}

export function emitUserNotification(userId: string, payload: unknown): void {
  requireIO().to(`user:${userId}`).emit('notification:new', payload);
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
