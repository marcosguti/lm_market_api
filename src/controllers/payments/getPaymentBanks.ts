import type { Response } from 'express';

import { megasoftConfig } from '../../config/megasoft.js';
import { getBanksForMegasoft } from '../../data/venezuelanBanks.js';

export async function getPaymentBanks(_req: unknown, res: Response): Promise<void> {
  const banks = getBanksForMegasoft(megasoftConfig.supportedBankCodes);
  res.json({ banks });
}

export async function getPaymentConfig(_req: unknown, res: Response): Promise<void> {
  const merchantBank = getBanksForMegasoft(megasoftConfig.supportedBankCodes).find(
    (b) => b.code === megasoftConfig.merchantBankCode,
  );

  res.json({
    megasoftEnabled: megasoftConfig.enabled,
    merchant: {
      bankCode: megasoftConfig.merchantBankCode,
      bankName: merchantBank?.name ?? megasoftConfig.merchantBankName,
      phone: megasoftConfig.merchantPhone,
      rif: megasoftConfig.merchantRif,
    },
  });
}
