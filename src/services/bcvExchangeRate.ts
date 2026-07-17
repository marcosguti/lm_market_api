import { Prisma } from '@prisma/client';
import https from 'node:https';

import prisma from '../prisma.js';

export const USD_VES_PAIR = 'USD_VES';
export const DEFAULT_USD_VES_RATE = 600;

export type ExchangeRateSource = 'bcv' | 'bdv' | 'dolarapi' | 'env' | 'manual';

export interface UsdVesRateInfo {
  fetchedAt: Date | null;
  rate: number;
  source: 'fallback' | ExchangeRateSource;
}

const BCV_URL = 'https://www.bcv.org.ve/';
const BDV_TASAS_URL = 'https://www.bancodevenezuela.com/files/tasas/tasas2.json';
const DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const FETCH_TIMEOUT_MS = 20_000;

export function extractBcvUsdRateFromHtml(html: string): number {
  // BCV markup varies: <strong>…</strong> or <strong class="strong-tb">…</strong>
  const match = html.match(/id=["']dolar["'][\s\S]*?<strong\b[^>]*>\s*([\d.,]+)\s*<\/strong>/i);
  if (!match?.[1]) {
    throw new Error('BCV USD rate element (#dolar strong) not found');
  }
  return parseBcvDecimal(match[1]);
}

/** Parses BDV tasas2.json → mesacambio.bcv.dolares */
export function extractBdvUsdRateFromJson(payload: unknown): number {
  if (!payload || typeof payload !== 'object') {
    throw new Error('BDV tasas payload is not an object');
  }
  const mesa = (payload as { mesacambio?: { bcv?: { dolares?: unknown } } }).mesacambio;
  const raw = mesa?.bcv?.dolares;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('BDV mesacambio.bcv.dolares not found');
  }
  return parseBcvDecimal(raw);
}

/** Parses ve.dolarapi.com oficial → promedio */
export function extractDolarApiUsdRateFromJson(payload: unknown): number {
  if (!payload || typeof payload !== 'object') {
    throw new Error('DolarAPI payload is not an object');
  }
  const promedio = (payload as { promedio?: unknown }).promedio;
  const value = typeof promedio === 'number' ? promedio : Number(promedio);
  if (!Number.isFinite(value) || value <= 1) {
    throw new Error(`DolarAPI promedio invalid: ${String(promedio)}`);
  }
  return value;
}

export async function fetchBcvUsdRate(): Promise<number> {
  const html = await fetchTextInsecure(BCV_URL, 'text/html,application/xhtml+xml');
  return extractBcvUsdRateFromHtml(html);
}

export async function fetchBdvUsdRate(): Promise<number> {
  const text = await fetchTextInsecure(BDV_TASAS_URL, 'application/json');
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error('BDV tasas response is not valid JSON');
  }
  return extractBdvUsdRateFromJson(payload);
}

export async function fetchDolarApiUsdRate(): Promise<number> {
  const text = await fetchTextInsecure(DOLAR_API_URL, 'application/json');
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error('DolarAPI response is not valid JSON');
  }
  return extractDolarApiUsdRateFromJson(payload);
}

export async function getUsdVesRate(): Promise<number> {
  const info = await getUsdVesRateInfo();
  return info.rate;
}

export async function getUsdVesRateInfo(): Promise<UsdVesRateInfo> {
  const row = await prisma.exchangeRate.findUnique({ where: { pair: USD_VES_PAIR } });
  if (row) {
    return {
      fetchedAt: row.fetchedAt,
      rate: Number(row.rate.toString()),
      source: row.source as ExchangeRateSource,
    };
  }

  const envRate = parseEnvUsdPrice();
  return {
    fetchedAt: null,
    rate: envRate,
    source: process.env.USD_PRICE ? 'env' : 'fallback',
  };
}

/** Parses BCV/BDV Venezuelan decimal format (e.g. `725,76200000`). */
export function parseBcvDecimal(raw: string): number {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 1) {
    throw new Error(`Invalid BCV rate value: "${raw}"`);
  }
  return value;
}

/**
 * Tries BCV HTML → BDV JSON → DolarAPI.
 * If all fail, keeps last DB value and returns null.
 */
export async function syncBcvExchangeRate(): Promise<null | UsdVesRateInfo> {
  const attempts: { fetch: () => Promise<number>; label: string; source: ExchangeRateSource }[] = [
    { fetch: fetchBcvUsdRate, label: 'BCV scrape', source: 'bcv' },
    { fetch: fetchBdvUsdRate, label: 'BDV tasas JSON', source: 'bdv' },
    { fetch: fetchDolarApiUsdRate, label: 'DolarAPI oficial', source: 'dolarapi' },
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    try {
      const rate = await attempt.fetch();
      const info = await upsertUsdVesRate(rate, attempt.source);
      // eslint-disable-next-line no-console -- operational BCV sync
      console.log(`[bcv-rate] updated USD_VES=${info.rate} source=${info.source}`);
      return info;
    } catch (error) {
      const next = attempts[i + 1];
      if (next) {
        console.error(`[bcv-rate] ${attempt.label} failed; trying ${next.label}`, error);
      } else {
        console.error(`[bcv-rate] ${attempt.label} failed; keeping last known rate`, error);
      }
    }
  }

  return null;
}

export async function upsertUsdVesRate(
  rate: number,
  source: ExchangeRateSource,
  fetchedAt: Date = new Date(),
): Promise<UsdVesRateInfo> {
  if (!Number.isFinite(rate) || rate <= 1) {
    throw new Error(`Refusing to store invalid USD_VES rate: ${rate}`);
  }

  const row = await prisma.exchangeRate.upsert({
    create: {
      fetchedAt,
      pair: USD_VES_PAIR,
      rate: new Prisma.Decimal(rate),
      source,
    },
    update: {
      fetchedAt,
      rate: new Prisma.Decimal(rate),
      source,
    },
    where: { pair: USD_VES_PAIR },
  });

  return {
    fetchedAt: row.fetchedAt,
    rate: Number(row.rate.toString()),
    source: row.source as ExchangeRateSource,
  };
}

function fetchTextInsecure(url: string, accept: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: accept,
          'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (compatible; lm-market-api/bcv-rate-sync; +https://lm-market.local)',
        },
        rejectUnauthorized: false,
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        const { statusCode } = res;
        if (statusCode && (statusCode < 200 || statusCode >= 400)) {
          res.resume();
          reject(new Error(`HTTP ${statusCode} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out for ${url}`));
    });
  });
}

function parseEnvUsdPrice(): number {
  const parsed = Number(process.env.USD_PRICE ?? String(DEFAULT_USD_VES_RATE));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_USD_VES_RATE;
  return parsed;
}
