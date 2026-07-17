import { syncBcvExchangeRate } from '../services/bcvExchangeRate.js';

const INTERVAL_HOURS = 6;
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | undefined;

export async function runBcvRateSync(): Promise<void> {
  await syncBcvExchangeRate();
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
