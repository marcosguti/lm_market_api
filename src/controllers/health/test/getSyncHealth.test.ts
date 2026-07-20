import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSyncJobStatuses = vi.hoisted(() => vi.fn());
const evaluateHealth = vi.hoisted(() => vi.fn());

vi.mock('../../../services/syncJobStatus.js', () => ({
  evaluateHealth,
  getAllSyncJobStatuses,
}));

import { getSyncHealth } from '../getSyncHealth.js';

function mockRes() {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
}

describe('getSyncHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 when healthy', async () => {
    getAllSyncJobStatuses.mockResolvedValue({ bcv: null, products: null });
    evaluateHealth.mockReturnValue({
      bcv: {
        healthy: true,
        job: 'bcv_rate',
        lastError: null,
        lastFinishedAt: null,
        lastStartedAt: null,
        lastSucceededAt: '2026-07-20T10:00:00.000Z',
        reason: null,
        status: 'ok',
      },
      ok: true,
      products: {
        healthy: true,
        job: 'external_products',
        lastError: null,
        lastFinishedAt: null,
        lastStartedAt: null,
        lastSucceededAt: '2026-07-20T11:00:00.000Z',
        reason: null,
        status: 'ok',
      },
    });

    const res = mockRes();
    await getSyncHealth({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        products: expect.objectContaining({ healthy: true, status: 'ok' }),
      }),
    );
  });

  it('returns 503 when unhealthy', async () => {
    getAllSyncJobStatuses.mockResolvedValue({ bcv: null, products: null });
    evaluateHealth.mockReturnValue({
      bcv: {
        healthy: false,
        job: 'bcv_rate',
        lastError: 'sources failed',
        lastFinishedAt: null,
        lastStartedAt: null,
        lastSucceededAt: null,
        reason: 'failed',
        status: 'failed',
      },
      ok: false,
      products: {
        healthy: true,
        job: 'external_products',
        lastError: null,
        lastFinishedAt: null,
        lastStartedAt: null,
        lastSucceededAt: '2026-07-20T11:00:00.000Z',
        reason: null,
        status: 'ok',
      },
    });

    const res = mockRes();
    await getSyncHealth({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
