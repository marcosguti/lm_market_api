import type { UserType } from '@prisma/client';
import type { Response } from 'express';

import type { AuthRequest } from './auth.js';

export class StoreScopeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

/**
 * Admin may only access orders of their assigned store.
 * superAdmin is unrestricted. Other roles are denied.
 */
export function assertAdminCanAccessOrder(
  actorType: undefined | UserType,
  actorStoreId: null | string | undefined,
  order: { storeId: null | string },
): void {
  if (actorType === 'superAdmin') return;
  if (actorType === 'admin') {
    if (!actorStoreId) {
      throw new StoreScopeError('FORBIDDEN', 'Acceso denegado', 403);
    }
    if (!order.storeId || order.storeId !== actorStoreId) {
      throw new StoreScopeError('FORBIDDEN', 'Acceso denegado', 403);
    }
    return;
  }
  throw new StoreScopeError('FORBIDDEN', 'Acceso denegado', 403);
}

/**
 * Admin may edit clients freely, and deliveryDrivers only of their own store.
 * Cannot edit admin/superAdmin. superAdmin is unrestricted here (caller still
 * enforces who may set storeId / create admins).
 */
export function assertAdminCanManageUser(
  actorType: undefined | UserType,
  actorStoreId: null | string | undefined,
  target: { storeId: null | string; type: string | UserType },
): void {
  if (actorType === 'superAdmin') return;
  if (actorType !== 'admin') {
    throw new StoreScopeError('FORBIDDEN', 'Acceso denegado', 403);
  }
  if (target.type === 'admin' || target.type === 'superAdmin') {
    throw new StoreScopeError('FORBIDDEN', 'Acceso denegado', 403);
  }
  if (target.type === 'deliveryDriver') {
    if (!actorStoreId || target.storeId !== actorStoreId) {
      throw new StoreScopeError('FORBIDDEN', 'Acceso denegado', 403);
    }
  }
  // client: allowed
}

/** Blocks admin actors that have no store assigned (fail-closed for store-scoped ops). */
export function requireAdminHasStore(req: AuthRequest, res: Response, next: () => void): void {
  if (req.userType === 'admin' && !req.storeId) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }
  next();
}
