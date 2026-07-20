import type { Request, Response } from 'express';

import { evaluateHealth, getAllSyncJobStatuses } from '../../services/syncJobStatus.js';

export async function getSyncHealth(_req: Request, res: Response): Promise<void> {
  const statuses = await getAllSyncJobStatuses();
  const health = evaluateHealth(statuses);

  res.status(health.ok ? 200 : 503).json({
    bcv: {
      healthy: health.bcv.healthy,
      lastFinishedAt: health.bcv.lastFinishedAt,
      lastStartedAt: health.bcv.lastStartedAt,
      lastSucceededAt: health.bcv.lastSucceededAt,
      reason: health.bcv.reason,
      status: health.bcv.status,
    },
    ok: health.ok,
    products: {
      healthy: health.products.healthy,
      lastFinishedAt: health.products.lastFinishedAt,
      lastStartedAt: health.products.lastStartedAt,
      lastSucceededAt: health.products.lastSucceededAt,
      reason: health.products.reason,
      status: health.products.status,
    },
  });
}
