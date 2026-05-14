import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../auth.js';

export type EndpointGuardHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export type RegisteredGuard = {
  handler: EndpointGuardHandler;
  match: (req: AuthRequest) => boolean;
};
