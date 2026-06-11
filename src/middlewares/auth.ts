import type { UserType } from '@prisma/client';
import type { Request, Response } from 'express';

import { verifyToken } from '../libs/jwt.js';
import { findUserById } from '../queries/user.js';

export interface AuthRequest extends Request {
  userId?: string;
  userType?: UserType;
}

export async function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: () => void,
): Promise<void> {
  const authHeader = req.headers.authorization;
  // eslint-disable-next-line no-console
  console.log(
    '[authMiddleware]',
    req.method,
    req.path,
    'auth:',
    authHeader ? 'present' : 'missing',
  );
  if (!authHeader?.startsWith('Bearer ')) {
    // eslint-disable-next-line no-console
    console.log('[authMiddleware] no Bearer prefix, passing through');
    next();
    return;
  }

  const token = authHeader.slice(7);
  // eslint-disable-next-line no-console
  console.log('[authMiddleware] token length:', token.length);
  try {
    const payload = verifyToken(token);
    // eslint-disable-next-line no-console
    console.log('[authMiddleware] token verified, userId:', payload.userId);
    const user = await findUserById(payload.userId);
    if (user) {
      req.userId = payload.userId;
      req.userType = user.type;
      // eslint-disable-next-line no-console
      console.log('[authMiddleware] user set, type:', user.type);
    } else {
      // eslint-disable-next-line no-console
      console.log('[authMiddleware] user NOT found for userId:', payload.userId);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[authMiddleware] token error:', err);
  }
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: () => void): void {
  // eslint-disable-next-line no-console
  console.log('[requireAuth]', req.method, req.path, 'userId:', req.userId ?? 'MISSING');
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function requireRole(allowedTypes: UserType[]) {
  return (req: AuthRequest, res: Response, next: () => void): void => {
    if (!req.userId || !req.userType) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!allowedTypes.includes(req.userType)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
