import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendOpsAlertEmail = vi.hoisted(() => vi.fn());
const markAlerted = vi.hoisted(() => vi.fn());
const shouldSendAlert = vi.hoisted(() => vi.fn());

vi.mock('../../libs/sendEmail/index.js', () => ({
  sendOpsAlertEmail,
}));

vi.mock('../syncJobStatus.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../syncJobStatus.js')>();
  return {
    ...actual,
    markAlerted,
    shouldSendAlert,
  };
});

import { maybeAlertSyncFailure } from '../syncAlert.js';
import { SYNC_JOB_EXTERNAL_PRODUCTS } from '../syncJobStatus.js';

describe('maybeAlertSyncFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markAlerted.mockResolvedValue(undefined);
    sendOpsAlertEmail.mockResolvedValue(undefined);
  });

  it('skips email when cooldown is active', async () => {
    shouldSendAlert.mockReturnValue(false);

    await maybeAlertSyncFailure({
      error: 'boom',
      job: SYNC_JOB_EXTERNAL_PRODUCTS,
      previous: null,
      status: 'failed',
    });

    expect(sendOpsAlertEmail).not.toHaveBeenCalled();
    expect(markAlerted).not.toHaveBeenCalled();
  });

  it('sends email and marks alerted when allowed', async () => {
    shouldSendAlert.mockReturnValue(true);

    await maybeAlertSyncFailure({
      details: { storeFailures: 1 },
      error: 'boom',
      job: SYNC_JOB_EXTERNAL_PRODUCTS,
      previous: null,
      status: 'failed',
    });

    expect(sendOpsAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'boom',
        job: SYNC_JOB_EXTERNAL_PRODUCTS,
        status: 'failed',
      }),
    );
    expect(markAlerted).toHaveBeenCalledWith(SYNC_JOB_EXTERNAL_PRODUCTS);
  });

  it('does not throw when mailjet fails', async () => {
    shouldSendAlert.mockReturnValue(true);
    sendOpsAlertEmail.mockRejectedValue(new Error('mailjet down'));

    await expect(
      maybeAlertSyncFailure({
        error: 'boom',
        job: SYNC_JOB_EXTERNAL_PRODUCTS,
        previous: null,
        status: 'failed',
      }),
    ).resolves.toBeUndefined();
  });
});
