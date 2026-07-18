import type { Response } from 'express';

import { megasoftConfig } from '../../config/megasoft.js';
import { getBanksForMegasoft } from '../../data/venezuelanBanks.js';
import { getUsdVesRateInfo } from '../../services/bcvExchangeRate.js';
import { getActivePaymentMethodConfigs } from '../../services/paymentMethodConfigService.js';

export async function getPaymentBanks(_req: unknown, res: Response): Promise<void> {
  const banks = getBanksForMegasoft(megasoftConfig.supportedBankCodes);
  res.json({ banks });
}

export async function getPaymentConfig(_req: unknown, res: Response): Promise<void> {
  const merchantBank = getBanksForMegasoft(megasoftConfig.supportedBankCodes).find(
    (b) => b.code === megasoftConfig.merchantBankCode,
  );
  const rateInfo = await getUsdVesRateInfo();
  const methods = await getActivePaymentMethodConfigs();

  // methods must be first in the public config payload for clients
  /* eslint-disable perfectionist/sort-objects -- methods first by product contract */
  res.json({
    methods,
    megasoftEnabled: megasoftConfig.enabled,
    merchant: {
      bankCode: megasoftConfig.merchantBankCode,
      bankName: merchantBank?.name ?? megasoftConfig.merchantBankName,
      phone: megasoftConfig.merchantPhone,
      rif: megasoftConfig.merchantRif,
    },
    usdRate: rateInfo.rate,
    usdRateSource: rateInfo.source,
    usdRateUpdatedAt: rateInfo.fetchedAt?.toISOString() ?? null,
  });
  /* eslint-enable perfectionist/sort-objects */
}
