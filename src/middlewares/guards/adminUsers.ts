import type { UserType } from '@prisma/client';
import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../auth.js';
import type { RegisteredGuard } from './types.js';

import { countSuperAdminUsers, findUserById } from '../../queries/user.js';

const ADMIN_USERS_PREFIX = '/api/admin/users';

function adminMayOnlyTargetClientOrDelivery(targetType: UserType): boolean {
  return targetType === 'client' || targetType === 'deliveryDriver';
}

function extractUserIdFromPath(path: string): null | string {
  const base = `${ADMIN_USERS_PREFIX}/`;
  if (!path.startsWith(base)) return null;
  const rest = path.slice(base.length);
  if (!rest || rest.includes('/')) return null;
  return rest;
}

async function guardDeleteAdminUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!requireAdminOrSuperAdmin(req, res)) return;
  const id = extractUserIdFromPath(req.path);
  if (!id) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  const target = await findUserById(id);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (req.userType === 'admin') {
    if (!adminMayOnlyTargetClientOrDelivery(target.type)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }
  if (target.type === 'superAdmin') {
    const count = await countSuperAdminUsers();
    if (count <= 1) {
      res.status(403).json({ error: 'Cannot delete the last super admin' });
      return;
    }
  }
  next();
}

async function guardGetAdminUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!requireAdminOrSuperAdmin(req, res)) return;
  next();
}

async function guardPatchAdminUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!requireAdminOrSuperAdmin(req, res)) return;
  const id = extractUserIdFromPath(req.path);
  if (!id) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  const target = await findUserById(id);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const body = req.body as { type?: string };
  if (body.type === 'superAdmin') {
    res.status(403).json({ error: 'Cannot assign super admin role' });
    return;
  }
  if (target.type === 'superAdmin' && body.type !== undefined) {
    res.status(403).json({ error: 'Cannot change role of a super admin user' });
    return;
  }
  if (req.userType === 'admin') {
    if (!adminMayOnlyTargetClientOrDelivery(target.type)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (body.type !== undefined) {
      const nextType = body.type as UserType;
      if (nextType !== 'client' && nextType !== 'deliveryDriver') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
  }
  next();
}

async function guardPostAdminUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!requireAdminOrSuperAdmin(req, res)) return;
  const body = req.body as { type?: string };
  const t = body?.type as undefined | UserType;
  if (!t) {
    res.status(400).json({ error: 'type is required' });
    return;
  }
  if (t === 'superAdmin') {
    res.status(403).json({ error: 'Cannot create super admin users' });
    return;
  }
  if (t === 'admin') {
    if (req.userType !== 'superAdmin') {
      res.status(403).json({ error: 'Only superAdmin can create admin users' });
      return;
    }
  } else if (t !== 'client' && t !== 'deliveryDriver') {
    res.status(400).json({ error: 'Invalid user type' });
    return;
  }
  next();
}

function matchMethodAndPath(
  req: AuthRequest,
  method: string,
  mode: 'collection' | 'item',
): boolean {
  if (!pathMatchesUsers(req)) return false;
  if (req.method !== method) return false;
  const isCollection = req.path === ADMIN_USERS_PREFIX;
  const isItem = req.path.startsWith(`${ADMIN_USERS_PREFIX}/`) && req.path !== ADMIN_USERS_PREFIX;
  if (mode === 'collection') return isCollection;
  return isItem;
}

function pathMatchesUsers(req: AuthRequest): boolean {
  return req.path === ADMIN_USERS_PREFIX || req.path.startsWith(`${ADMIN_USERS_PREFIX}/`);
}

function requireAdminOrSuperAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.userId || !req.userType) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (req.userType !== 'admin' && req.userType !== 'superAdmin') {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export const adminUsersGuards: RegisteredGuard[] = [
  {
    handler: guardGetAdminUsers,
    match: (req) => matchMethodAndPath(req, 'GET', 'collection'),
  },
  {
    handler: guardPostAdminUsers,
    match: (req) => matchMethodAndPath(req, 'POST', 'collection'),
  },
  {
    handler: guardPatchAdminUsers,
    match: (req) => matchMethodAndPath(req, 'PATCH', 'item'),
  },
  {
    handler: guardDeleteAdminUsers,
    match: (req) => matchMethodAndPath(req, 'DELETE', 'item'),
  },
];
