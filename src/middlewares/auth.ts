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
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    const user = await findUserById(payload.userId);
    if (user) {
      req.userId = payload.userId;
      req.userType = user.type;
    }
  } catch {
    // ignore invalid token
  }
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: () => void): void {
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
