import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../auth.js';
import type { RegisteredGuard } from './types.js';

const ADMIN_PRODUCTS_PREFIX = '/api/admin/products';

async function guardAdminProducts(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!requireAdminOrSuperAdmin(req, res)) return;
  next();
}

function matchMethodAndPath(
  req: AuthRequest,
  method: string,
  mode: 'collection' | 'item',
): boolean {
  if (!pathMatchesProducts(req)) return false;
  if (req.method !== method) return false;
  const isCollection = req.path === ADMIN_PRODUCTS_PREFIX;
  const isItem =
    req.path.startsWith(`${ADMIN_PRODUCTS_PREFIX}/`) && req.path !== ADMIN_PRODUCTS_PREFIX;
  if (mode === 'collection') return isCollection;
  return isItem;
}

function pathMatchesProducts(req: AuthRequest): boolean {
  return req.path === ADMIN_PRODUCTS_PREFIX || req.path.startsWith(`${ADMIN_PRODUCTS_PREFIX}/`);
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

export const adminProductsGuards: RegisteredGuard[] = [
  {
    handler: guardAdminProducts,
    match: (req) => matchMethodAndPath(req, 'GET', 'collection'),
  },
  {
    handler: guardAdminProducts,
    match: (req) => matchMethodAndPath(req, 'POST', 'collection'),
  },
  {
    handler: guardAdminProducts,
    match: (req) => matchMethodAndPath(req, 'PATCH', 'item'),
  },
  {
    handler: guardAdminProducts,
    match: (req) => matchMethodAndPath(req, 'DELETE', 'item'),
  },
];
