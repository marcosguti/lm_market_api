import type { Request, Response } from 'express';

import { verifyToken } from '../libs/jwt.js';
import { findUserById } from '../queries/user.js';

export interface AuthRequest extends Request {
  userId?: string;
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
