import { syncExternalProducts } from '../services/syncExternalProducts.js';

const INTERVAL_MINS = 60;
const INTERVAL_MS = INTERVAL_MINS * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | undefined;

export async function runExternalProductsSync(): Promise<void> {
  try {
    const { deleted, lastPage, skippedWithoutCode, sourceDistinctCodes, totalElements, upserted } =
      await syncExternalProducts();
    // eslint-disable-next-line no-console -- operational sync summary
    console.log(
      `[product-sync] completed: upserted=${upserted}, deleted=${deleted}, sourceDistinctCodes=${sourceDistinctCodes}, skippedWithoutCode=${skippedWithoutCode}, totalElements=${totalElements}, lastPage=${lastPage}`,
    );
  } catch (error) {
    console.error('[product-sync] sync failed', error);
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
