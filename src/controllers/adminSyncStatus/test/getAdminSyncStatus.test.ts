import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';

const getAllSyncJobStatuses = vi.hoisted(() => vi.fn());
const evaluateHealth = vi.hoisted(() => vi.fn());
const toAdminSyncStatusPayload = vi.hoisted(() => vi.fn());

vi.mock('../../../services/syncJobStatus.js', () => ({
  evaluateHealth,
  getAllSyncJobStatuses,
  toAdminSyncStatusPayload,
}));

import { getAdminSyncStatus } from '../getAdminSyncStatus.js';

function mockRes() {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & { json: ReturnType<typeof vi.fn> };
}

describe('getAdminSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toAdminSyncStatusPayload.mockImplementation((record: null | { job: string }) => ({
      details: null,
      job: record?.job ?? null,
      lastAlertedAt: null,
      lastError: null,
      lastFinishedAt: null,
      lastStartedAt: null,
      lastSucceededAt: null,
      status: null,
      updatedAt: null,
    }));
  });

  it('returns enriched status payload', async () => {
    getAllSyncJobStatuses.mockResolvedValue({
      bcv: { job: 'bcv_rate' },
      products: { job: 'external_products' },
    });
    evaluateHealth.mockReturnValue({
      bcv: { healthy: true, reason: null },
      ok: true,
      products: { healthy: false, reason: 'stale' },
    });

    const res = mockRes();
    await getAdminSyncStatus({} as AuthRequest, res);

    expect(res.json).toHaveBeenCalledWith({
      data: {
        bcv: expect.objectContaining({ healthy: true, job: 'bcv_rate' }),
        ok: true,
        products: expect.objectContaining({
          healthy: false,
          job: 'external_products',
          reason: 'stale',
        }),
      },
    });
  });
});
