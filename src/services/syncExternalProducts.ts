import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import prisma from '../prisma.js';

const SYNC_FETCH_PAGE_SIZE = 1000;

export interface ExternalProductRow {
  codigoInterno: string;
  costo: number;
  departamento: string;
  descripcion: string;
  existenciaTotal: number;
  marca: string;
  margenPct: number;
  movimientosAdm: number;
  precio: number;
  saldoInicial: number;
  valorInventarioBs: number;
  ventasVivoHoy: number;
}

export interface ExternalProductSearchResponse {
  currentPage: number;
  results: ExternalProductRow[];
  totalElements: number;
  totalPages: number;
}

export function buildExternalProductsRequest(
  page: number,
  pageSizeOverride?: number,
): {
  headers: Record<string, string>;
  url: string;
} {
  const baseUrl = getSyncBaseUrl();
  const pageSize =
    pageSizeOverride !== undefined && Number.isFinite(pageSizeOverride)
      ? Math.min(Math.max(1, Math.trunc(pageSizeOverride)), SYNC_FETCH_PAGE_SIZE)
      : SYNC_FETCH_PAGE_SIZE;
  const url = new URL(baseUrl);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = process.env.EXTERNAL_PRODUCTS_API_KEY?.trim();
  const apiKeyHeader = process.env.EXTERNAL_PRODUCTS_API_KEY_HEADER?.trim() || 'X-Api-Key';
  if (apiKey) headers[apiKeyHeader] = apiKey;
  return { headers, url: url.toString() };
}

export async function syncExternalProducts(): Promise<{
  deleted: number;
  lastPage: number;
  skippedWithoutCode: number;
  sourceDistinctCodes: number;
  totalElements: number;
  upserted: number;
}> {
  let page = 1;
  let totalPages = 1;
  let totalElements = 0;
  let upserted = 0;
  let lastProcessedPage = 0;
  let skippedWithoutCode = 0;
  const sourceCodes = new Set<string>();

  while (page <= totalPages) {
    const { headers, url } = buildExternalProductsRequest(page);
    if (page === 1) {
      // eslint-disable-next-line no-console -- sync diagnostics (URL has no secrets)
      console.log(
        `[product-sync] source GET ${url} (API key header: ${Object.keys(headers).find((k) => k.toLowerCase() !== 'accept') ?? 'none'})`,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180_000);
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Node 20 global fetch
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`External products API failed: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as ExternalProductSearchResponse;
    const rows = Array.isArray(body.results) ? body.results : [];
    const te = Number(body.totalElements);
    if (Number.isFinite(te) && te >= 0) totalElements = te;
    const declaredPages = Number(body.totalPages);
    if (Number.isFinite(declaredPages) && declaredPages >= 1) {
      totalPages = declaredPages;
    } else if (totalElements > 0) {
      totalPages = Math.max(1, Math.ceil(totalElements / SYNC_FETCH_PAGE_SIZE));
    } else {
      totalPages = Math.max(1, page);
    }

    lastProcessedPage = page;

    for (const row of rows) {
      const code = String(row.codigoInterno ?? '').trim();
      if (!code) {
        skippedWithoutCode += 1;
        continue;
      }
      sourceCodes.add(code);
      const args = mapRowToUpsertArgs(row);
      await prisma.product.upsert(args);
      upserted += 1;
    }

    if (rows.length === 0) break;
    if (totalElements > 0 && upserted >= totalElements) break;
    page += 1;
  }

  const sourceCodesList = Array.from(sourceCodes);
  const { count: deleted } =
    sourceCodesList.length > 0
      ? await prisma.product.deleteMany({
          where: {
            code: {
              notIn: sourceCodesList,
            },
          },
        })
      : await prisma.product.deleteMany();

  return {
    deleted,
    lastPage: lastProcessedPage,
    skippedWithoutCode,
    sourceDistinctCodes: sourceCodes.size,
    totalElements,
    upserted,
  };
}

function getSyncBaseUrl(): string {
  return (
    process.env.EXTERNAL_PRODUCTS_BASE_URL?.trim() ||
    'https://lmmarket.leandatech.com/api/productos/full-search'
  );
}

function mapRowToUpsertArgs(row: ExternalProductRow): {
  create: Prisma.ProductCreateInput;
  update: Prisma.ProductUpdateInput;
  where: { code: string };
} {
  const code = String(row.codigoInterno ?? '').trim();
  const description = String(row.descripcion ?? '').trim();
  const brand = String(row.marca ?? '').trim();
  const department = String(row.departamento ?? '').trim() || '—';

  const baseData = {
    adminMovements: Math.trunc(Number(row.movimientosAdm ?? 0)),
    brand: brand || '—',
    code: code || randomUUID(),
    cost: new Prisma.Decimal(String(row.costo ?? 0)),
    department,
    description: description || null,
    initialBalance: Math.trunc(Number(row.saldoInicial ?? 0)),
    inventoryValueBs: new Prisma.Decimal(String(row.valorInventarioBs ?? 0)),
    marginPct: new Prisma.Decimal(String(row.margenPct ?? 0)),
    name: description || code || 'Producto',
    price: new Prisma.Decimal(String(row.precio ?? 0)),
    salesToday: Math.trunc(Number(row.ventasVivoHoy ?? 0)),
    totalStock: Math.trunc(Number(row.existenciaTotal ?? 0)),
  };

  return {
    create: {
      id: randomUUID(),
      ...baseData,
    },
    update: {
      adminMovements: baseData.adminMovements,
      brand: baseData.brand,
      code: baseData.code,
      cost: baseData.cost,
      department: baseData.department,
      description: baseData.description,
      initialBalance: baseData.initialBalance,
      inventoryValueBs: baseData.inventoryValueBs,
      marginPct: baseData.marginPct,
      name: baseData.name,
      price: baseData.price,
      salesToday: baseData.salesToday,
      totalStock: baseData.totalStock,
    },
    where: { code },
  };
}
