import { syncBcvExchangeRate } from '../services/bcvExchangeRate.js';
import { maybeAlertSyncFailure } from '../services/syncAlert.js';
import {
  getSyncJobStatus,
  markFailed,
  markOk,
  markRunning,
  SYNC_JOB_BCV_RATE,
} from '../services/syncJobStatus.js';

const INTERVAL_HOURS = 6;
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | undefined;
let inFlight = false;

export async function runBcvRateSync(): Promise<void> {
  if (inFlight) {
    // eslint-disable-next-line no-console -- operational sync mutex
    console.warn('[bcv-rate] skip: previous run still in flight');
    return;
  }

  inFlight = true;
  const previous = await getSyncJobStatus(SYNC_JOB_BCV_RATE).catch(() => null);

  try {
    await markRunning(SYNC_JOB_BCV_RATE);
    const info = await syncBcvExchangeRate();

    if (!info) {
      const error = 'All USD/VES rate sources failed; kept last known rate';
      await markFailed(SYNC_JOB_BCV_RATE, error);
      await maybeAlertSyncFailure({
        error,
        job: SYNC_JOB_BCV_RATE,
        previous,
        status: 'failed',
      });
      return;
    }

    await markOk(SYNC_JOB_BCV_RATE, {
      fetchedAt: info.fetchedAt?.toISOString() ?? null,
      rate: info.rate,
      source: info.source,
    });
  } catch (error) {
    console.error('[bcv-rate] sync failed', error);
    const message = error instanceof Error ? error.message : String(error);
    try {
      await markFailed(SYNC_JOB_BCV_RATE, message);
      await maybeAlertSyncFailure({
        error: message,
        job: SYNC_JOB_BCV_RATE,
        previous,
        status: 'failed',
      });
    } catch (statusErr) {
      console.error('[bcv-rate] failed to persist sync status', statusErr);
    }
  } finally {
    inFlight = false;
  }
}

export function startBcvRateSyncSchedule(): void {
  if (intervalId !== undefined) return;
  intervalId = setInterval(() => {
    runBcvRateSync().catch((err) => {
      console.error('[bcv-rate] scheduled run failed', err);
    });
  }, INTERVAL_MS);
  // eslint-disable-next-line no-console -- operational sync schedule
  console.log(`[bcv-rate] interval started (every ${INTERVAL_HOURS} hours)`);
}
