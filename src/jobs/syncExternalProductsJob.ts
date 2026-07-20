import { maybeAlertSyncFailure } from '../services/syncAlert.js';
import { syncExternalProducts } from '../services/syncExternalProducts.js';
import {
  getSyncJobStatus,
  markFailed,
  markIncomplete,
  markOk,
  markRunning,
  SYNC_JOB_EXTERNAL_PRODUCTS,
} from '../services/syncJobStatus.js';

const INTERVAL_MINS = 60;
const INTERVAL_MS = INTERVAL_MINS * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | undefined;
let inFlight = false;

export async function runExternalProductsSync(): Promise<void> {
  if (inFlight) {
    // eslint-disable-next-line no-console -- operational sync mutex
    console.warn('[product-sync] skip: previous run still in flight');
    return;
  }

  inFlight = true;
  const previous = await getSyncJobStatus(SYNC_JOB_EXTERNAL_PRODUCTS).catch(() => null);

  try {
    await markRunning(SYNC_JOB_EXTERNAL_PRODUCTS);
    const summary = await syncExternalProducts();
    const details = {
      incompleteStoreCount: summary.incompleteStoreCount,
      storeFailures: summary.storeFailures,
      stores: summary.stores.map((s) => ({
        branch: s.branch,
        complete: s.complete,
        deactivated: s.deactivated,
        error: s.error,
        failed: s.failed,
        pageErrors: s.pageErrors,
        rowErrors: s.rowErrors,
        sourceCodeCount: s.sourceCodeCount,
        storeName: s.storeName,
        upserted: s.upserted,
      })),
      storesTotal: summary.storesTotal,
    };

    if (summary.storeFailures > 0 && summary.incompleteStoreCount === 0) {
      const allFailed = summary.storeFailures === summary.storesTotal;
      const error = allFailed
        ? `All ${summary.storesTotal} store sync(s) failed`
        : `${summary.storeFailures}/${summary.storesTotal} store sync(s) failed`;
      if (allFailed) {
        await markFailed(SYNC_JOB_EXTERNAL_PRODUCTS, error, details);
        await maybeAlertSyncFailure({
          details,
          error,
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          previous,
          status: 'failed',
        });
      } else {
        await markIncomplete(SYNC_JOB_EXTERNAL_PRODUCTS, error, details);
        await maybeAlertSyncFailure({
          details,
          error,
          job: SYNC_JOB_EXTERNAL_PRODUCTS,
          previous,
          status: 'incomplete',
        });
      }
      return;
    }

    if (summary.incompleteStoreCount > 0 || summary.storeFailures > 0) {
      const error = `Incomplete product sync: ${summary.incompleteStoreCount} incomplete, ${summary.storeFailures} failed of ${summary.storesTotal}`;
      await markIncomplete(SYNC_JOB_EXTERNAL_PRODUCTS, error, details);
      await maybeAlertSyncFailure({
        details,
        error,
        job: SYNC_JOB_EXTERNAL_PRODUCTS,
        previous,
        status: 'incomplete',
      });
      return;
    }

    await markOk(SYNC_JOB_EXTERNAL_PRODUCTS, details);
  } catch (error) {
    console.error('[product-sync] sync failed', error);
    const message = error instanceof Error ? error.message : String(error);
    try {
      await markFailed(SYNC_JOB_EXTERNAL_PRODUCTS, message);
      await maybeAlertSyncFailure({
        error: message,
        job: SYNC_JOB_EXTERNAL_PRODUCTS,
        previous,
        status: 'failed',
      });
    } catch (statusErr) {
      console.error('[product-sync] failed to persist sync status', statusErr);
    }
  } finally {
    inFlight = false;
  }
}

export function startExternalProductsSyncSchedule(): void {
  if (intervalId !== undefined) return;
  intervalId = setInterval(() => {
    runExternalProductsSync().catch((err) => {
      console.error('[product-sync] scheduled run failed', err);
    });
  }, INTERVAL_MS);
  // eslint-disable-next-line no-console -- operational sync schedule
  console.log(`[product-sync] interval started (every ${INTERVAL_MINS} minutes)`);
}
