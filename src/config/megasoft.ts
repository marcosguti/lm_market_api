import { getUsdVesRate } from '../services/bcvExchangeRate.js';

export const megasoftCertP2cPayload = {
  clientBankCode: '0105',
  clientPhone: '04125555444',
  merchantBankCode: '0138',
  merchantPhone: '04121234567',
} as const;

export function convertUsdToBs(orderAmount: number, usdRate: number): number {
  return Number((orderAmount * usdRate).toFixed(2));
}

export async function resolveMegasoftAmount(orderAmount: number): Promise<number> {
  if (megasoftConfig.amountOverride !== null) {
    return megasoftConfig.amountOverride;
  }
  const usdRate = await getUsdVesRate();
  return convertUsdToBs(orderAmount, usdRate);
}

function parseBool(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseOptionalPositiveNumber(value: string | undefined): null | number {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseUsdPrice(value: string | undefined): number {
  const parsed = Number(value ?? '600');
  if (!Number.isFinite(parsed) || parsed <= 0) return 600;
  return parsed;
}

export const megasoftConfig = {
  affiliationCode: process.env.MEGASOFT_AFFILIATION_CODE ?? '',
  amountOverride: parseOptionalPositiveNumber(process.env.MEGASOFT_AMOUNT_OVERRIDE),
  baseUrl: (process.env.MEGASOFT_BASE_URL ?? '').replace(/\/$/, ''),
  certHardcoded: parseBool(process.env.MEGASOFT_CERT_HARDCODED),
  debugLogs: parseBool(process.env.MEGASOFT_DEBUG_LOGS),
  enabled: parseBool(process.env.MEGASOFT_ENABLED),
  merchantBankCode: process.env.MEGASOFT_MERCHANT_BANK_CODE ?? '0138',
  merchantBankName: process.env.MEGASOFT_MERCHANT_BANK_NAME ?? 'Banco Plaza',
  merchantCid: process.env.MEGASOFT_MERCHANT_CID ?? '',
  merchantPhone: process.env.MEGASOFT_MERCHANT_PHONE ?? '04121234567',
  merchantRif: process.env.MEGASOFT_MERCHANT_RIF ?? '',
  password: process.env.MEGASOFT_PASSWORD ?? '',
  paymentType: process.env.MEGASOFT_PAYMENT_TYPE ?? '10',
  simulatePlatformDown: parseBool(process.env.MEGASOFT_SIMULATE_PLATFORM_DOWN),
  supportedBankCodes: (process.env.MEGASOFT_SUPPORTED_BANK_CODES ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean),
  tlsInsecure: parseBool(process.env.MEGASOFT_TLS_INSECURE, true),
  /** Fallback / bootstrap rate from env; live rate comes from ExchangeRate via getUsdVesRate. */
  usdPrice: parseUsdPrice(process.env.USD_PRICE),
  user: process.env.MEGASOFT_USER ?? '',
};

export function isMegasoftConfigured(): boolean {
  const c = megasoftConfig;
  return Boolean(c.baseUrl && c.user && c.password && c.affiliationCode && c.merchantPhone);
}
