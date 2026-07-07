export interface MegasoftP2cInput {
  amount: number;
  clientBankCode: string;
  clientPhone: string;
  invoice: string;
  nationalId: string;
  reference: string;
}

export interface MegasoftTransactionResult {
  authId: null | string;
  code: null | string;
  control: null | string;
  description: null | string;
  rawXml: string;
  reference: null | string;
  seqNum: null | string;
  status: MegasoftTransactionStatus | null;
  voucher: string;
}

export type MegasoftTransactionStatus = 'A' | 'C' | 'P' | 'R' | string;

export class MegasoftPaymentRejectedError extends Error {
  constructor(
    message: string,
    public readonly result: MegasoftTransactionResult,
  ) {
    super(message);
    this.name = 'MegasoftPaymentRejectedError';
  }
}

export class MegasoftPlatformError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'MegasoftPlatformError';
  }
}
