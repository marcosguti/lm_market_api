import { afterEach, describe, expect, it, vi } from 'vitest';

describe('megasoft config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('resolveMegasoftAmount converts order total using USD price', async () => {
    vi.stubEnv('USD_PRICE', '600');
    vi.stubEnv('MEGASOFT_AMOUNT_OVERRIDE', '');
    const { resolveMegasoftAmount } = await import('../megasoft.js');
    expect(resolveMegasoftAmount(1.23)).toBe(738);
  });

  it('resolveMegasoftAmount uses override when set', async () => {
    vi.stubEnv('MEGASOFT_AMOUNT_OVERRIDE', '50');
    vi.stubEnv('USD_PRICE', '600');
    const { resolveMegasoftAmount } = await import('../megasoft.js');
    expect(resolveMegasoftAmount(100)).toBe(50);
  });

  it('isMegasoftConfigured returns false when required fields are missing', async () => {
    vi.stubEnv('MEGASOFT_BASE_URL', '');
    vi.stubEnv('MEGASOFT_USER', '');
    const { isMegasoftConfigured } = await import('../megasoft.js');
    expect(isMegasoftConfigured()).toBe(false);
  });

  it('isMegasoftConfigured returns true when all required fields exist', async () => {
    vi.stubEnv('MEGASOFT_BASE_URL', 'https://megasoft.test');
    vi.stubEnv('MEGASOFT_USER', 'user');
    vi.stubEnv('MEGASOFT_PASSWORD', 'pass');
    vi.stubEnv('MEGASOFT_AFFILIATION_CODE', 'AFF');
    vi.stubEnv('MEGASOFT_MERCHANT_PHONE', '04120000000');
    const { isMegasoftConfigured } = await import('../megasoft.js');
    expect(isMegasoftConfigured()).toBe(true);
  });
});
