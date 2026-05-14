import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../auth.js';
import type { RegisteredGuard } from './types.js';

import { adminProductsGuards } from './adminProducts.js';
import { adminUsersGuards } from './adminUsers.js';

const allGuards: RegisteredGuard[] = [...adminUsersGuards, ...adminProductsGuards];

export function endpointGuard(req: AuthRequest, res: Response, next: NextFunction): void {
  void (async () => {
    for (const guard of allGuards) {
      if (guard.match(req)) {
        await guard.handler(req, res, next);
        return;
      }
    }
    next();
  })().catch(next);
}
