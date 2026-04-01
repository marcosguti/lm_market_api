import { syncExternalProducts } from '../services/syncExternalProducts.js';

const INTERVAL_MINS = 10;
const INTERVAL_MS = INTERVAL_MINS * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | undefined;

export async function runExternalProductsSync(): Promise<void> {
  const { deleted, lastPage, skippedWithoutCode, sourceDistinctCodes, totalElements, upserted } =
    await syncExternalProducts();
  // eslint-disable-next-line no-console -- operational sync summary
  console.log(
    `[product-sync] completed: upserted=${upserted}, deleted=${deleted}, sourceDistinctCodes=${sourceDistinctCodes}, skippedWithoutCode=${skippedWithoutCode}, totalElements=${totalElements}, lastPage=${lastPage}`,
  );
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
