import type { Brand, Department, Prisma } from '@prisma/client';

import prisma from '../prisma.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PLACEHOLDER_NAME = '—';

export function buildBrandFilter(value?: string): Prisma.ProductWhereInput {
  const v = value?.trim();
  if (!v) return {};
  if (isUuid(v)) return { brandId: v };
  return {
    OR: [
      { brandRef: { name: { equals: v, mode: 'insensitive' } } },
      { brand: { equals: v, mode: 'insensitive' } },
    ],
  };
}

export function buildDepartmentFilter(value?: string): Prisma.ProductWhereInput {
  const v = value?.trim();
  if (!v) return {};
  if (isUuid(v)) return { departmentId: v };
  return {
    OR: [
      { departmentRef: { name: { equals: v, mode: 'insensitive' } } },
      { department: { equals: v, mode: 'insensitive' } },
    ],
  };
}

export async function findAllBrandsForCatalog(): Promise<Pick<Brand, 'id' | 'name'>[]> {
  return prisma.brand.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
    where: {
      name: { not: PLACEHOLDER_NAME },
      products: { some: { active: true } },
    },
  });
}

export async function findAllDepartmentsForCatalog(): Promise<Pick<Department, 'id' | 'name'>[]> {
  return prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
    where: {
      name: { not: PLACEHOLDER_NAME },
      products: { some: { active: true } },
    },
  });
}

export async function findOrCreateBrand(name: string): Promise<Brand> {
  const normalized = normalizeCatalogName(name);
  const existing = await prisma.brand.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.brand.create({ data: { name: normalized } });
}

export async function findOrCreateDepartment(name: string): Promise<Department> {
  const normalized = normalizeCatalogName(name);
  const existing = await prisma.department.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.department.create({ data: { name: normalized } });
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export async function loadBrandNameToIdMap(): Promise<Map<string, string>> {
  const rows = await prisma.brand.findMany({ select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.name, r.id]));
}

export async function loadDepartmentNameToIdMap(): Promise<Map<string, string>> {
  const rows = await prisma.department.findMany({ select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.name, r.id]));
}

export function normalizeCatalogName(raw: null | string | undefined): string {
  const trimmed = String(raw ?? '').trim();
  return trimmed || PLACEHOLDER_NAME;
}

export async function resolveBrandId(name: string, cache: Map<string, string>): Promise<string> {
  const normalized = normalizeCatalogName(name);
  const cached = cache.get(normalized);
  if (cached) return cached;
  const row = await findOrCreateBrand(normalized);
  cache.set(row.name, row.id);
  return row.id;
}

export async function resolveDepartmentId(
  name: string,
  cache: Map<string, string>,
): Promise<string> {
  const normalized = normalizeCatalogName(name);
  const cached = cache.get(normalized);
  if (cached) return cached;
  const row = await findOrCreateDepartment(normalized);
  cache.set(row.name, row.id);
  return row.id;
}
