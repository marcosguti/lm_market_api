import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import prisma from '../prisma.js';
import {
  loadBrandNameToIdMap,
  loadDepartmentNameToIdMap,
  normalizeCatalogName,
  resolveBrandId,
  resolveDepartmentId,
} from '../queries/brandDepartment.js';

/** Máximo admitido por el API de productos externos */
const SYNC_FETCH_PAGE_SIZE = 500;

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
  if (apiKey) headers['X-Api-Key'] = apiKey;
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
  const brandCache = await loadBrandNameToIdMap();
  const departmentCache = await loadDepartmentNameToIdMap();

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
        `[product-sync] resolved totalPages=${totalPages} (API declared=${declaredFinite ? declaredPages : 'n/a'}, totalElements=${totalElements}, firstPageRows=${rows.length}, requestedPageSize=${SYNC_FETCH_PAGE_SIZE})`,
      );
      // eslint-disable-next-line no-console -- sync diagnostics
      console.log(
        `[product-sync] inicio: totalElements=${totalElements}, páginas a sincronizar=${totalPages}`,
      );
    } else if (totalElements <= 0 && Number.isFinite(declaredPages) && declaredPages >= 1) {
      totalPages = declaredPages;
    }

    lastProcessedPage = page;

    let pageUpserted = 0;
    let pageSkippedWithoutCode = 0;

    for (const row of rows) {
      const code = String(row.codigoInterno ?? '').trim();
      if (!code) {
        skippedWithoutCode += 1;
        pageSkippedWithoutCode += 1;
        continue;
      }
      sourceCodes.add(code);
      const brandId = await resolveBrandId(String(row.marca ?? ''), brandCache);
      const departmentId = await resolveDepartmentId(
        String(row.departamento ?? ''),
        departmentCache,
      );
      const args = mapRowToUpsertArgs(row, brandId, departmentId);
      await prisma.product.upsert(args);
      upserted += 1;
      pageUpserted += 1;
    }

    const totalLabel = totalElements > 0 ? String(totalElements) : '?';
    // eslint-disable-next-line no-console -- sync diagnostics
    console.log(
      `[product-sync] página ${page}/${totalPages}: filas=${rows.length}, upserted=${pageUpserted}, sinCódigo=${pageSkippedWithoutCode}, acumulado upserted=${upserted}/${totalLabel}, códigos distintos=${sourceCodes.size}`,
    );

    if (rows.length === 0) break;
    if (totalElements > 0 && upserted >= totalElements) break;
    page += 1;
  }

  const sourceCodesList = Array.from(sourceCodes);

  const deactivateWhere: Prisma.ProductWhereInput =
    sourceCodesList.length > 0
      ? {
          active: true,
          code: { notIn: sourceCodesList },
          OR: [{ imageUrl: null }, { imageUrl: '' }],
        }
      : {
          active: true,
          OR: [{ imageUrl: null }, { imageUrl: '' }],
        };

  const { count: deactivated } = await prisma.product.updateMany({
    data: { active: false },
    where: deactivateWhere,
  });

  // eslint-disable-next-line no-console -- sync diagnostics
  console.log(
    `[product-sync] fin: totalElements=${totalElements}, upserted=${upserted}, páginas=${lastProcessedPage}, códigos distintos=${sourceCodes.size}, sinCódigo=${skippedWithoutCode}, desactivados=${deactivated}`,
  );

  return {
    deleted: deactivated,
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

function mapRowToUpsertArgs(
  row: ExternalProductRow,
  brandId: string,
  departmentId: string,
): {
  create: Prisma.ProductCreateInput;
  update: Prisma.ProductUpdateInput;
  where: { code: string };
} {
  const code = String(row.codigoInterno ?? '').trim();
  const description = String(row.descripcion ?? '').trim();
  const brandName = normalizeCatalogName(String(row.marca ?? ''));
  const departmentName = normalizeCatalogName(String(row.departamento ?? ''));

  const baseData = {
    adminMovements: Math.trunc(Number(row.movimientosAdm ?? 0)),
    brand: brandName,
    brandRef: { connect: { id: brandId } },
    code: code || randomUUID(),
    cost: new Prisma.Decimal(String(row.costo ?? 0)),
    department: departmentName,
    departmentRef: { connect: { id: departmentId } },
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
      active: true,
      id: randomUUID(),
      ...baseData,
    },
    update: {
      adminMovements: baseData.adminMovements,
      brand: baseData.brand,
      brandRef: baseData.brandRef,
      code: baseData.code,
      cost: baseData.cost,
      department: baseData.department,
      departmentRef: baseData.departmentRef,
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
