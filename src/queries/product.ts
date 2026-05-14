import type { Prisma, Product } from '@prisma/client';

import prisma from '../prisma.js';

export type AdminProductActiveFilter = 'all' | 'false' | 'true';

export interface FindAdminProductsPaginatedParams {
  active?: AdminProductActiveFilter;
  page: number;
  pageSize: number;
  search?: string;
  sort?: null | ProductListSort;
}

export interface FindProductsPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  sort?: null | ProductListSort;
}

export interface FindProductsPaginatedResult {
  data: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ProductListSort = 'priceAsc' | 'priceDesc';

export async function createProduct(data: Prisma.ProductCreateInput): Promise<Product> {
  return prisma.product.create({ data });
}

export async function deactivateProductById(id: string): Promise<Product> {
  return prisma.product.update({
    data: { active: false },
    where: { id },
  });
}

export async function findAdminProductsPaginated(
  params: FindAdminProductsPaginatedParams,
): Promise<FindProductsPaginatedResult> {
  const { active = 'all', page, pageSize, search, sort } = params;
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
    ...buildSearchWhere(searchTrim),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
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

export async function findProductByCode(code: string): Promise<null | Product> {
  return prisma.product.findUnique({ where: { code } });
}

export async function findProductById(id: string): Promise<null | Product> {
  return prisma.product.findUnique({ where: { id } });
}

export async function findProductsPaginated(
  params: FindProductsPaginatedParams,
): Promise<FindProductsPaginatedResult> {
  const { page, pageSize, search, sort } = params;
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
    ...buildSearchWhere(searchTrim),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
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
): Promise<Product> {
  return prisma.product.update({ data, where: { id } });
}

function buildSearchWhere(searchTrim: string | undefined): Prisma.ProductWhereInput {
  if (!searchTrim) return {};
  return {
    OR: [
      { description: { contains: searchTrim, mode: 'insensitive' } },
      { brand: { contains: searchTrim, mode: 'insensitive' } },
      { name: { contains: searchTrim, mode: 'insensitive' } },
      { code: { contains: searchTrim, mode: 'insensitive' } },
    ],
  };
}
