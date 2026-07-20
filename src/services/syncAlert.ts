import { sendOpsAlertEmail } from '../libs/sendEmail/index.js';
import {
  markAlerted,
  shouldSendAlert,
  type SyncJobName,
  type SyncJobRunStatus,
  type SyncJobStatusRecord,
} from './syncJobStatus.js';

/**
 * Fire-and-forget ops alert with cooldown. Never throws to the job caller.
 */
export async function maybeAlertSyncFailure(params: {
  details?: unknown;
  error?: null | string;
  job: SyncJobName;
  previous: null | SyncJobStatusRecord;
  status: Extract<SyncJobRunStatus, 'failed' | 'incomplete'>;
}): Promise<void> {
  const { details, error, job, previous, status } = params;
  if (!shouldSendAlert(previous)) {
    // eslint-disable-next-line no-console -- ops alert cooldown
    console.log(`[sync-alert] cooldown active for ${job}; skipping email`);
    return;
  }

  let detailsText: null | string = null;
  if (details !== undefined && details !== null) {
    try {
      detailsText = JSON.stringify(details, null, 2);
    } catch {
      detailsText = String(details);
    }
  }

  try {
    await sendOpsAlertEmail({
      detailsText,
      error: error ?? null,
      job,
      status,
    });
    await markAlerted(job);
  } catch (err) {
    console.error(`[sync-alert] failed to send email for ${job}`, err);
  }
}
