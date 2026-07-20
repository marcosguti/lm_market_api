import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import {
  evaluateHealth,
  getAllSyncJobStatuses,
  toAdminSyncStatusPayload,
} from '../../services/syncJobStatus.js';

export async function getAdminSyncStatus(_req: AuthRequest, res: Response): Promise<void> {
  const statuses = await getAllSyncJobStatuses();
  const health = evaluateHealth(statuses);

  res.json({
    data: {
      bcv: {
        ...toAdminSyncStatusPayload(statuses.bcv),
        healthy: health.bcv.healthy,
        reason: health.bcv.reason,
      },
      ok: health.ok,
      products: {
        ...toAdminSyncStatusPayload(statuses.products),
        healthy: health.products.healthy,
        reason: health.products.reason,
      },
    },
  });
}
