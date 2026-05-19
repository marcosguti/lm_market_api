import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

export function asClient(req: AuthRequest, res: Response): null | string {
  if (!req.userId || req.userType !== 'client') {
    res.status(403).json({ error: 'Only client users can use cart/order endpoints' });
    return null;
  }
  return req.userId;
}
