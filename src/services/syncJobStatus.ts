import type { Prisma } from '@prisma/client';

import { randomUUID } from 'crypto';

import prisma from '../prisma.js';

export const SYNC_JOB_EXTERNAL_PRODUCTS = 'external_products';
export const SYNC_JOB_BCV_RATE = 'bcv_rate';

export type SyncJobName = typeof SYNC_JOB_BCV_RATE | typeof SYNC_JOB_EXTERNAL_PRODUCTS;

export type SyncJobRunStatus = 'failed' | 'incomplete' | 'ok' | 'running';

export type SyncJobStatusRecord = {
  details: null | Prisma.JsonValue;
  job: string;
  lastAlertedAt: Date | null;
  lastError: null | string;
  lastFinishedAt: Date | null;
  lastStartedAt: Date | null;
  lastSucceededAt: Date | null;
  status: SyncJobRunStatus;
  updatedAt: Date;
};

/** Product sync interval is 60m → stale after 2× */
export const PRODUCT_SYNC_STALE_MS = 2 * 60 * 60 * 1000;
/** BCV sync interval is 6h → stale after 2× */
export const BCV_SYNC_STALE_MS = 12 * 60 * 60 * 1000;
/** Product sync stuck if running longer than this */
export const PRODUCT_SYNC_RUNNING_MAX_MS = 90 * 60 * 1000;
/** BCV sync stuck if running longer than this */
export const BCV_SYNC_RUNNING_MAX_MS = 30 * 60 * 1000;
/** Do not re-alert the same job within this window */
export const SYNC_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export type JobHealthSnapshot = {
  healthy: boolean;
  job: SyncJobName;
  lastError: null | string;
  lastFinishedAt: null | string;
  lastStartedAt: null | string;
  lastSucceededAt: null | string;
  reason: null | string;
  status: null | SyncJobRunStatus;
};

export type SyncHealthEvaluation = {
  bcv: JobHealthSnapshot;
  ok: boolean;
  products: JobHealthSnapshot;
};

export function evaluateHealth(
  statuses: {
    bcv: null | SyncJobStatusRecord;
    products: null | SyncJobStatusRecord;
  },
  now: Date = new Date(),
): SyncHealthEvaluation {
  const products = evaluateJobHealth(SYNC_JOB_EXTERNAL_PRODUCTS, statuses.products, now);
  const bcv = evaluateJobHealth(SYNC_JOB_BCV_RATE, statuses.bcv, now);
  return {
    bcv,
    ok: products.healthy && bcv.healthy,
    products,
  };
}

export async function getAllSyncJobStatuses(): Promise<{
  bcv: null | SyncJobStatusRecord;
  products: null | SyncJobStatusRecord;
}> {
  const rows = await prisma.syncJobStatus.findMany({
    where: { job: { in: [SYNC_JOB_EXTERNAL_PRODUCTS, SYNC_JOB_BCV_RATE] } },
  });
  const byJob = new Map(rows.map((r) => [r.job, toRecord(r)]));
  return {
    bcv: byJob.get(SYNC_JOB_BCV_RATE) ?? null,
    products: byJob.get(SYNC_JOB_EXTERNAL_PRODUCTS) ?? null,
  };
}

export async function getSyncJobStatus(job: SyncJobName): Promise<null | SyncJobStatusRecord> {
  const row = await prisma.syncJobStatus.findUnique({ where: { job } });
  return row ? toRecord(row) : null;
}

export async function markAlerted(job: SyncJobName): Promise<void> {
  const now = new Date();
  await prisma.syncJobStatus.update({
    data: { lastAlertedAt: now },
    where: { job },
  });
}

export async function markFailed(
  job: SyncJobName,
  lastError: string,
  details?: Prisma.InputJsonValue,
): Promise<SyncJobStatusRecord> {
  return markTerminal(job, 'failed', lastError, details);
}

export async function markIncomplete(
  job: SyncJobName,
  lastError: string,
  details?: Prisma.InputJsonValue,
): Promise<SyncJobStatusRecord> {
  return markTerminal(job, 'incomplete', lastError, details);
}

export async function markOk(
  job: SyncJobName,
  details?: Prisma.InputJsonValue,
): Promise<SyncJobStatusRecord> {
  const now = new Date();
  const row = await prisma.syncJobStatus.upsert({
    create: {
      details: details ?? undefined,
      id: randomUUID(),
      job,
      lastError: null,
      lastFinishedAt: now,
      lastStartedAt: now,
      lastSucceededAt: now,
      status: 'ok',
    },
    update: {
      details: details ?? undefined,
      lastError: null,
      lastFinishedAt: now,
      lastSucceededAt: now,
      status: 'ok',
    },
    where: { job },
  });
  return toRecord(row);
}

export async function markRunning(
  job: SyncJobName,
  details?: Prisma.InputJsonValue,
): Promise<SyncJobStatusRecord> {
  const now = new Date();
  const row = await prisma.syncJobStatus.upsert({
    create: {
      details: details ?? undefined,
      id: randomUUID(),
      job,
      lastError: null,
      lastStartedAt: now,
      status: 'running',
    },
    update: {
      details: details ?? undefined,
      lastError: null,
      lastStartedAt: now,
      status: 'running',
    },
    where: { job },
  });
  return toRecord(row);
}

export function shouldSendAlert(
  record: null | SyncJobStatusRecord,
  now: Date = new Date(),
  cooldownMs: number = SYNC_ALERT_COOLDOWN_MS,
): boolean {
  if (!record?.lastAlertedAt) return true;
  return now.getTime() - record.lastAlertedAt.getTime() >= cooldownMs;
}

export function toAdminSyncStatusPayload(record: null | SyncJobStatusRecord): {
  details: null | Prisma.JsonValue;
  job: null | string;
  lastAlertedAt: null | string;
  lastError: null | string;
  lastFinishedAt: null | string;
  lastStartedAt: null | string;
  lastSucceededAt: null | string;
  status: null | SyncJobRunStatus;
  updatedAt: null | string;
} {
  if (!record) {
    return {
      details: null,
      job: null,
      lastAlertedAt: null,
      lastError: null,
      lastFinishedAt: null,
      lastStartedAt: null,
      lastSucceededAt: null,
      status: null,
      updatedAt: null,
    };
  }
  return {
    details: record.details,
    job: record.job,
    lastAlertedAt: record.lastAlertedAt?.toISOString() ?? null,
    lastError: record.lastError,
    lastFinishedAt: record.lastFinishedAt?.toISOString() ?? null,
    lastStartedAt: record.lastStartedAt?.toISOString() ?? null,
    lastSucceededAt: record.lastSucceededAt?.toISOString() ?? null,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function asRunStatus(raw: string): SyncJobRunStatus {
  if (raw === 'running' || raw === 'ok' || raw === 'failed' || raw === 'incomplete') {
    return raw;
  }
  return 'failed';
}

function evaluateJobHealth(
  job: SyncJobName,
  record: null | SyncJobStatusRecord,
  now: Date,
): JobHealthSnapshot {
  const base: JobHealthSnapshot = {
    healthy: false,
    job,
    lastError: record?.lastError ?? null,
    lastFinishedAt: record?.lastFinishedAt?.toISOString() ?? null,
    lastStartedAt: record?.lastStartedAt?.toISOString() ?? null,
    lastSucceededAt: record?.lastSucceededAt?.toISOString() ?? null,
    reason: null,
    status: record?.status ?? null,
  };

  if (!record) {
    return { ...base, reason: 'never_ran' };
  }

  const staleMs = job === SYNC_JOB_EXTERNAL_PRODUCTS ? PRODUCT_SYNC_STALE_MS : BCV_SYNC_STALE_MS;
  const runningMaxMs =
    job === SYNC_JOB_EXTERNAL_PRODUCTS ? PRODUCT_SYNC_RUNNING_MAX_MS : BCV_SYNC_RUNNING_MAX_MS;

  if (record.status === 'failed' || record.status === 'incomplete') {
    return { ...base, reason: record.status };
  }

  if (record.status === 'running') {
    const started = record.lastStartedAt?.getTime() ?? 0;
    if (now.getTime() - started > runningMaxMs) {
      return { ...base, reason: 'stuck_running' };
    }
    // Still running within window — treat as healthy for monitors
    return { ...base, healthy: true, reason: null };
  }

  if (!record.lastSucceededAt) {
    return { ...base, reason: 'never_succeeded' };
  }

  if (now.getTime() - record.lastSucceededAt.getTime() > staleMs) {
    return { ...base, reason: 'stale' };
  }

  return { ...base, healthy: true, reason: null };
}

async function markTerminal(
  job: SyncJobName,
  status: 'failed' | 'incomplete',
  lastError: string,
  details?: Prisma.InputJsonValue,
): Promise<SyncJobStatusRecord> {
  const now = new Date();
  const truncated = lastError.length > 2000 ? `${lastError.slice(0, 1997)}...` : lastError;
  const row = await prisma.syncJobStatus.upsert({
    create: {
      details: details ?? undefined,
      id: randomUUID(),
      job,
      lastError: truncated,
      lastFinishedAt: now,
      lastStartedAt: now,
      status,
    },
    update: {
      details: details ?? undefined,
      lastError: truncated,
      lastFinishedAt: now,
      status,
    },
    where: { job },
  });
  return toRecord(row);
}

function toRecord(row: {
  details: Prisma.JsonValue;
  job: string;
  lastAlertedAt: Date | null;
  lastError: null | string;
  lastFinishedAt: Date | null;
  lastStartedAt: Date | null;
  lastSucceededAt: Date | null;
  status: string;
  updatedAt: Date;
}): SyncJobStatusRecord {
  return {
    details: row.details,
    job: row.job,
    lastAlertedAt: row.lastAlertedAt,
    lastError: row.lastError,
    lastFinishedAt: row.lastFinishedAt,
    lastStartedAt: row.lastStartedAt,
    lastSucceededAt: row.lastSucceededAt,
    status: asRunStatus(row.status),
    updatedAt: row.updatedAt,
  };
}
