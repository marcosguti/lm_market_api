import type { Prisma } from '@prisma/client';

import prisma from '../prisma.js';
import { buildBrandFilter, buildDepartmentFilter } from './brandDepartment.js';

export type AdminProductActiveFilter = 'all' | 'false' | 'true';

export interface FindAdminProductsPaginatedParams {
  active?: AdminProductActiveFilter;
  brand?: string;
  department?: string;
  page: number;
  pageSize: number;
  search?: string;
  sort?: null | ProductListSort;
}

export interface FindProductsPaginatedParams {
  brand?: string;
  department?: string;
  page: number;
  pageSize: number;
  search?: string;
  sort?: null | ProductListSort;
}

export interface FindProductsPaginatedResult {
  data: ProductWithRelations[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ProductListSort = 'priceAsc' | 'priceDesc';
export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { brandRef: true; departmentRef: true };
}>;

const productInclude = { brandRef: true, departmentRef: true } as const;
const MIN_PUBLIC_STOCK = 10;

export async function createProduct(
  data: Prisma.ProductCreateInput,
): Promise<ProductWithRelations> {
  return prisma.product.create({ data, include: productInclude });
}

export async function deactivateProductById(id: string): Promise<ProductWithRelations> {
  return prisma.product.update({
    data: { active: false },
    include: productInclude,
    where: { id },
  });
}

export async function findAdminProductsPaginated(
  params: FindAdminProductsPaginatedParams,
): Promise<FindProductsPaginatedResult> {
  const { active = 'all', brand, department, page, pageSize, search, sort } = params;
  const skip = (page - 1) * pageSize;

  const searchTrim = search?.trim();
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === 'priceAsc'
      ? { price: 'asc' }
      : sort === 'priceDesc'
        ? { price: 'desc' }
        : { name: 'asc' };

  const activeWhere: Prisma.ProductWhereInput =
    active === 'all' ? {} : { active: active === 'true' };

  const where: Prisma.ProductWhereInput = {
    ...activeWhere,
    ...buildBrandFilter(brand),
    ...buildDepartmentFilter(department),
    ...buildSearchWhere(searchTrim),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      include: productInclude,
      orderBy,
      skip,
      take: pageSize,
      where,
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    data,
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function findProductByCode(code: string): Promise<null | ProductWithRelations> {
  return prisma.product.findUnique({ include: productInclude, where: { code } });
}

export async function findProductById(id: string): Promise<null | ProductWithRelations> {
  return prisma.product.findUnique({ include: productInclude, where: { id } });
}

export async function findProductsPaginated(
  params: FindProductsPaginatedParams,
): Promise<FindProductsPaginatedResult> {
  const { brand, department, page, pageSize, search, sort } = params;
  const skip = (page - 1) * pageSize;

  const searchTrim = search?.trim();
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === 'priceAsc'
      ? { price: 'asc' }
      : sort === 'priceDesc'
        ? { price: 'desc' }
        : { name: 'asc' };

  const where: Prisma.ProductWhereInput = {
    active: true,
    imageUrl: { not: null },
    totalStock: { gt: MIN_PUBLIC_STOCK },
    ...buildBrandFilter(brand),
    ...buildDepartmentFilter(department),
    ...buildSearchWhere(searchTrim),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      include: productInclude,
      orderBy,
      skip,
      take: pageSize,
      where,
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    data,
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function updateProductById(
  id: string,
  data: Prisma.ProductUpdateInput,
): Promise<ProductWithRelations> {
  return prisma.product.update({ data, include: productInclude, where: { id } });
}

function buildSearchWhere(searchTrim: string | undefined): Prisma.ProductWhereInput {
  if (!searchTrim) return {};
  return {
    OR: [
      { description: { contains: searchTrim, mode: 'insensitive' } },
      { brandRef: { name: { contains: searchTrim, mode: 'insensitive' } } },
      { brand: { contains: searchTrim, mode: 'insensitive' } },
      { departmentRef: { name: { contains: searchTrim, mode: 'insensitive' } } },
      { department: { contains: searchTrim, mode: 'insensitive' } },
      { name: { contains: searchTrim, mode: 'insensitive' } },
      { code: { contains: searchTrim, mode: 'insensitive' } },
    ],
  };
}
