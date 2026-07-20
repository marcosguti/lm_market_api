import { describe, expect, it } from 'vitest';

import {
  BCV_SYNC_STALE_MS,
  evaluateHealth,
  PRODUCT_SYNC_RUNNING_MAX_MS,
  PRODUCT_SYNC_STALE_MS,
  shouldSendAlert,
  SYNC_ALERT_COOLDOWN_MS,
  SYNC_JOB_BCV_RATE,
  SYNC_JOB_EXTERNAL_PRODUCTS,
  type SyncJobStatusRecord,
} from '../syncJobStatus.js';

function record(overrides: Partial<SyncJobStatusRecord> & { job: string }): SyncJobStatusRecord {
  return {
    details: null,
    lastAlertedAt: null,
    lastError: null,
    lastFinishedAt: null,
    lastStartedAt: null,
    lastSucceededAt: null,
    status: 'ok',
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('evaluateHealth', () => {
  const now = new Date('2026-07-20T12:00:00.000Z');

  it('is unhealthy when jobs never ran', () => {
    const health = evaluateHealth({ bcv: null, products: null }, now);
    expect(health.ok).toBe(false);
    expect(health.products.reason).toBe('never_ran');
    expect(health.bcv.reason).toBe('never_ran');
  });

  it('is healthy when both succeeded recently', () => {
    const health = evaluateHealth(
      {
        bcv: record({
          job: SYNC_JOB_BCV_RATE,
          lastSucceededAt: new Date(now.getTime() - 60 * 60 * 1000),
          status: 'ok',
        }),
        products: record({
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          lastSucceededAt: new Date(now.getTime() - 30 * 60 * 1000),
          status: 'ok',
        }),
      },
      now,
    );
    expect(health.ok).toBe(true);
    expect(health.products.healthy).toBe(true);
    expect(health.bcv.healthy).toBe(true);
  });

  it('marks products stale after threshold', () => {
    const health = evaluateHealth(
      {
        bcv: record({
          job: SYNC_JOB_BCV_RATE,
          lastSucceededAt: new Date(now.getTime() - 60 * 60 * 1000),
          status: 'ok',
        }),
        products: record({
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          lastSucceededAt: new Date(now.getTime() - PRODUCT_SYNC_STALE_MS - 1),
          status: 'ok',
        }),
      },
      now,
    );
    expect(health.ok).toBe(false);
    expect(health.products.reason).toBe('stale');
  });

  it('marks bcv stale after threshold', () => {
    const health = evaluateHealth(
      {
        bcv: record({
          job: SYNC_JOB_BCV_RATE,
          lastSucceededAt: new Date(now.getTime() - BCV_SYNC_STALE_MS - 1),
          status: 'ok',
        }),
        products: record({
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          lastSucceededAt: new Date(now.getTime() - 10 * 60 * 1000),
          status: 'ok',
        }),
      },
      now,
    );
    expect(health.ok).toBe(false);
    expect(health.bcv.reason).toBe('stale');
  });

  it('marks failed and incomplete as unhealthy', () => {
    const failed = evaluateHealth(
      {
        bcv: record({ job: SYNC_JOB_BCV_RATE, lastSucceededAt: now, status: 'ok' }),
        products: record({ job: SYNC_JOB_EXTERNAL_PRODUCTS, status: 'failed' }),
      },
      now,
    );
    expect(failed.products.reason).toBe('failed');

    const incomplete = evaluateHealth(
      {
        bcv: record({ job: SYNC_JOB_BCV_RATE, lastSucceededAt: now, status: 'ok' }),
        products: record({ job: SYNC_JOB_EXTERNAL_PRODUCTS, status: 'incomplete' }),
      },
      now,
    );
    expect(incomplete.products.reason).toBe('incomplete');
  });

  it('marks stuck running as unhealthy', () => {
    const health = evaluateHealth(
      {
        bcv: record({ job: SYNC_JOB_BCV_RATE, lastSucceededAt: now, status: 'ok' }),
        products: record({
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          lastStartedAt: new Date(now.getTime() - PRODUCT_SYNC_RUNNING_MAX_MS - 1),
          status: 'running',
        }),
      },
      now,
    );
    expect(health.products.reason).toBe('stuck_running');
  });

  it('treats recent running as healthy', () => {
    const health = evaluateHealth(
      {
        bcv: record({ job: SYNC_JOB_BCV_RATE, lastSucceededAt: now, status: 'ok' }),
        products: record({
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          lastStartedAt: new Date(now.getTime() - 5 * 60 * 1000),
          lastSucceededAt: new Date(now.getTime() - 40 * 60 * 1000),
          status: 'running',
        }),
      },
      now,
    );
    expect(health.products.healthy).toBe(true);
  });
});

describe('shouldSendAlert', () => {
  const now = new Date('2026-07-20T12:00:00.000Z');

  it('allows alert when never alerted', () => {
    expect(shouldSendAlert(null, now)).toBe(true);
    expect(shouldSendAlert(record({ job: SYNC_JOB_EXTERNAL_PRODUCTS }), now)).toBe(true);
  });

  it('blocks alert within cooldown', () => {
    expect(
      shouldSendAlert(
        record({
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          lastAlertedAt: new Date(now.getTime() - SYNC_ALERT_COOLDOWN_MS + 60_000),
        }),
        now,
      ),
    ).toBe(false);
  });

  it('allows alert after cooldown', () => {
    expect(
      shouldSendAlert(
        record({
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          lastAlertedAt: new Date(now.getTime() - SYNC_ALERT_COOLDOWN_MS - 1),
        }),
        now,
      ),
    ).toBe(true);
  });
});
