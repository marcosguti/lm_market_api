import { randomUUID } from 'crypto';

import prisma from '../prisma.js';
import {
  loadBrandNameToIdMap,
  loadDepartmentNameToIdMap,
  normalizeCatalogName,
  resolveBrandId,
  resolveDepartmentId,
} from '../queries/brandDepartment.js';
import { findProductByCode, upsertProductStore } from '../queries/product.js';
import { findStores } from '../queries/store.js';

/** Max page size supported by the external products API */
const SYNC_FETCH_PAGE_SIZE = 500;
const MAX_INT32 = 2_147_483_647;

export interface ExternalProductRow {
  brand: string;
  code: string;
  cost: number;
  department: string;
  description: string;
  price: number;
  stock: number;
}

export interface ExternalProductSearchResponse {
  currentPage?: number;
  data?: unknown[];
  pageNumber?: number;
  results?: unknown[];
  totalElements: number;
  totalPages: number;
}

export function buildExternalProductsRequest(
  page: number,
  branch: number,
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
  url.searchParams.set('branch', String(branch));
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = process.env.EXTERNAL_PRODUCTS_API_KEY?.trim();
  if (apiKey) headers['X-Api-Key'] = apiKey;
  return { headers, url: url.toString() };
}

export function extractProductRows(body: unknown): ExternalProductRow[] {
  const payload = body as Record<string, unknown>;
  const raw = payload.data ?? payload.results;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      brand: String(row.marca ?? row.brand ?? '').trim(),
      code: String(row.codigo ?? row.codigoInterno ?? '').trim(),
      cost: Number(row.costo ?? 0),
      department: String(row.departamento ?? row.department ?? '').trim(),
      description: String(row.descripcion ?? '').trim(),
      price: parseSyncPrice(row.precio),
      stock: parseStockQuantity(row.existencia ?? row.existenciaTotal),
    };
  });
}

export async function syncExternalProducts(): Promise<void> {
  const stores = await findStores();

  // eslint-disable-next-line no-console -- sync diagnostics
  console.log(`[product-sync] === Starting sync for ${stores.length} stores ===`);

  for (const store of stores) {
    const branch = parseInt(store.externalBranchCode, 10);
    // eslint-disable-next-line no-console -- sync diagnostics
    console.log(`[product-sync] Store: ${store.name} (branch=${branch}) - starting sync`);

    try {
      await syncStore(store.id, store.name, branch);
      // eslint-disable-next-line no-console -- sync diagnostics
      console.log(`[product-sync] Store: ${store.name} (branch=${branch}) - sync completed`);
    } catch (error) {
      console.error(`[product-sync] Store: ${store.name} (branch=${branch}) - sync failed:`, error);
      // Continue with next store
    }
  }

  // eslint-disable-next-line no-console -- sync diagnostics
  console.log('[product-sync] === All stores synced ===');
}

async function deactivateStaleProducts(storeId: string, sourceCodes: Set<string>): Promise<number> {
  const sourceCodesList = Array.from(sourceCodes);

  const { count } = await prisma.product.updateMany({
    data: { active: false },
    where: {
      active: true,
      code: { notIn: sourceCodesList },
      productStores: { some: { storeId } },
    },
  });

  return count;
}

function getSyncBaseUrl(): string {
  return (
    process.env.EXTERNAL_PRODUCTS_BASE_URL?.trim() ||
    'https://lmmarket.leandatech.com/api/productos/full-search'
  );
}

function isSyncComplete(params: {
  lastProcessedPage: number;
  pageErrors: number;
  sourceCodeCount: number;
  totalPages: number;
}): boolean {
  const { lastProcessedPage, pageErrors, sourceCodeCount, totalPages } = params;
  if (sourceCodeCount === 0) return false;
  if (pageErrors > 0) return false;
  if (lastProcessedPage < totalPages) return false;
  return true;
}

function parseStockQuantity(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;

  let n: number;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    n = /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.parseFloat(trimmed);
  } else {
    n = Number(raw);
  }

  if (!Number.isFinite(n)) return 0;
  const truncated = Math.trunc(n);
  if (truncated < 0) return 0;
  if (truncated > MAX_INT32) return MAX_INT32;
  return truncated;
}

function parseSyncPrice(raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * El API externo a veces ignora `pageSize` grande y sigue paginando de a ~10 ítems (totalPages=624).
 * Otras veces sí respeta nuestro pageSize pero devuelve totalPages demasiado bajo (p. ej. 2).
 * Decidimos cuántas peticiones hacer según el tamaño real del primer lote.
 */
function resolveSyncTotalPages(
  totalElements: number,
  declaredPages: number,
  firstPageRowCount: number,
  requestedPageSize: number,
): number {
  const declaredFinite = Number.isFinite(declaredPages) && declaredPages >= 1;

  if (totalElements <= 0) {
    return declaredFinite ? declaredPages : 1;
  }

  const pagesAtRequestedSize = Math.max(1, Math.ceil(totalElements / requestedPageSize));

  if (firstPageRowCount >= totalElements) {
    return 1;
  }

  const firstChunkMatchesRequestedSize = firstPageRowCount >= requestedPageSize;

  if (firstChunkMatchesRequestedSize) {
    return pagesAtRequestedSize;
  }

  if (declaredFinite && declaredPages > pagesAtRequestedSize) {
    return declaredPages;
  }

  const inferred =
    firstPageRowCount > 0 ? Math.ceil(totalElements / firstPageRowCount) : pagesAtRequestedSize;

  return Math.max(pagesAtRequestedSize, declaredFinite ? declaredPages : 0, inferred);
}

async function syncProductRow(
  row: ExternalProductRow,
  ctx: {
    brandCache: Map<string, string>;
    departmentCache: Map<string, string>;
    inStockCodes: Set<string>;
    sourceCodes: Set<string>;
    storeId: string;
  },
): Promise<'skipped_no_code' | 'synced'> {
  const code = row.code;
  if (!code) return 'skipped_no_code';

  ctx.sourceCodes.add(code);
  if (row.stock > 0) {
    ctx.inStockCodes.add(code);
  }

  const existing = await findProductByCode(code);
  if (existing) {
    await upsertProductStore(existing.id, ctx.storeId, row.price, row.stock);
    if (row.stock > 0 && !existing.active) {
      await prisma.product.update({ data: { active: true }, where: { id: existing.id } });
    }
    return 'synced';
  }

  const brandId = await resolveBrandId(row.brand, ctx.brandCache);
  const departmentId = await resolveDepartmentId(row.department, ctx.departmentCache);
  const description = row.description;
  const brandName = normalizeCatalogName(row.brand);
  const departmentName = normalizeCatalogName(row.department);

  const product = await prisma.product.create({
    data: {
      active: true,
      brand: brandName,
      brandRef: { connect: { id: brandId } },
      code,
      department: departmentName,
      departmentRef: { connect: { id: departmentId } },
      description: description || null,
      id: randomUUID(),
      name: description || code || 'Producto',
    },
  });

  await upsertProductStore(product.id, ctx.storeId, row.price, row.stock);
  return 'synced';
}

async function syncStore(storeId: string, storeName: string, branch: number): Promise<void> {
  const brandCache = await loadBrandNameToIdMap();
  const departmentCache = await loadDepartmentNameToIdMap();

  let page = 1;
  let totalPages = 1;
  let totalElements = 0;
  let upserted = 0;
  let lastProcessedPage = 0;
  let skippedWithoutCode = 0;
  let rowErrors = 0;
  let pageErrors = 0;
  const sourceCodes = new Set<string>();
  const inStockCodes = new Set<string>();

  while (page <= totalPages) {
    try {
      const { headers, url } = buildExternalProductsRequest(page, branch);
      if (page === 1) {
        // eslint-disable-next-line no-console -- sync diagnostics (URL has no secrets)
        console.log(`[product-sync] Store: ${storeName} (branch=${branch}) - GET ${url}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180_000);

      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`External products API failed: ${res.status} ${res.statusText}`);
      }

      const body = (await res.json()) as ExternalProductSearchResponse;
      const rows = extractProductRows(body);
      const te = Number(body.totalElements);
      if (Number.isFinite(te) && te >= 0) totalElements = te;
      const declaredPages = Number(body.totalPages);

      if (totalElements > 0 && rows.length === 0) {
        // eslint-disable-next-line no-console -- sync diagnostics
        console.warn(
          `[product-sync] Store: ${storeName} (branch=${branch}) - page ${page}: totalElements=${totalElements} but 0 rows parsed; body keys: ${Object.keys(body as object).join(', ')}`,
        );
      }

      if (page === 1) {
        totalPages = resolveSyncTotalPages(
          totalElements,
          declaredPages,
          rows.length,
          SYNC_FETCH_PAGE_SIZE,
        );
        const declaredFinite = Number.isFinite(declaredPages) && declaredPages >= 1;
        // eslint-disable-next-line no-console -- sync diagnostics
        console.log(
          `[product-sync] Store: ${storeName} (branch=${branch}) - resolved totalPages=${totalPages} (declared=${declaredFinite ? declaredPages : 'n/a'}, totalElements=${totalElements}, firstPageRows=${rows.length})`,
        );
      } else if (totalElements <= 0 && Number.isFinite(declaredPages) && declaredPages >= 1) {
        totalPages = declaredPages;
      }

      lastProcessedPage = page;

      let pageUpserted = 0;
      let pageSkippedWithoutCode = 0;

      for (const row of rows) {
        try {
          const processed = await syncProductRow(row, {
            brandCache,
            departmentCache,
            inStockCodes,
            sourceCodes,
            storeId,
          });
          if (processed === 'skipped_no_code') {
            skippedWithoutCode += 1;
            pageSkippedWithoutCode += 1;
            continue;
          }
          upserted += 1;
          pageUpserted += 1;
        } catch (err) {
          rowErrors += 1;
          console.error(
            `[product-sync] Store: ${storeName} (branch=${branch}) - row ${row.code || '?'} failed:`,
            err,
          );
        }
      }

      const totalLabel = totalElements > 0 ? String(totalElements) : '?';
      // eslint-disable-next-line no-console -- sync diagnostics
      console.log(
        `[product-sync] Store: ${storeName} (branch=${branch}) - page ${page}/${totalPages}: filas=${rows.length}, upserted=${pageUpserted}, sinCódigo=${pageSkippedWithoutCode}, acumulado=${upserted}/${totalLabel}`,
      );

      if (rows.length === 0) break;
      if (totalElements > 0 && upserted >= totalElements) break;
    } catch (error) {
      pageErrors += 1;

      console.error(
        `[product-sync] Store: ${storeName} (branch=${branch}) - page ${page} failed:`,
        error,
      );
      // Continue with next page
    }

    page += 1;
  }

  const syncComplete = isSyncComplete({
    lastProcessedPage,
    pageErrors,
    sourceCodeCount: sourceCodes.size,
    totalPages,
  });

  let deactivated = 0;

  if (!syncComplete) {
    // eslint-disable-next-line no-console -- sync diagnostics
    console.warn(
      `[product-sync] Store: ${storeName} (branch=${branch}) - skipping deactivation (incomplete sync: sourceCodes=${sourceCodes.size}, inStock=${inStockCodes.size}, páginas=${lastProcessedPage}/${totalPages}, erroresPágina=${pageErrors})`,
    );
  } else {
    deactivated = await deactivateStaleProducts(storeId, sourceCodes);
  }

  // eslint-disable-next-line no-console -- sync diagnostics
  console.log(
    `[product-sync] Store: ${storeName} (branch=${branch}) - done: upserted=${upserted}, sinCódigo=${skippedWithoutCode}, conExistencia=${inStockCodes.size}, desactivados=${deactivated}, páginas=${lastProcessedPage}/${totalPages}, erroresPágina=${pageErrors}, erroresFila=${rowErrors}`,
  );
}
