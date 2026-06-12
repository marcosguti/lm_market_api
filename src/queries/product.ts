import { Prisma } from '@prisma/client';

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
  storeId?: string;
}

export interface FindProductsPaginatedParams {
  brand?: string;
  department?: string;
  maxPrice?: number;
  minPrice?: number;
  page: number;
  pageSize: number;
  search?: string;
  sort?: null | ProductListSort;
  storeId?: string;
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
  include: { brandRef: true; departmentRef: true; productStores: { include: { store: true } } };
}>;

const productInclude = {
  brandRef: true,
  departmentRef: true,
  productStores: { include: { store: true } },
} as const;
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
  const { active = 'all', brand, department, page, pageSize, search, storeId } = params;
  const skip = (page - 1) * pageSize;

  const searchTrim = search?.trim();
  const orderBy: Prisma.ProductOrderByWithRelationInput = { name: 'asc' };

  const activeWhere: Prisma.ProductWhereInput =
    active === 'all' ? {} : { active: active === 'true' };

  const storeFilter = storeId ? { storeId } : {};

  const where: Prisma.ProductWhereInput = {
    ...activeWhere,
    ...(storeId ? { productStores: { some: storeFilter } } : {}),
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
  const { brand, department, maxPrice, minPrice, page, pageSize, search, storeId } = params;
  const skip = (page - 1) * pageSize;

  const searchTrim = search?.trim();
  const orderBy: Prisma.ProductOrderByWithRelationInput = { name: 'asc' };

  const storeFilter = storeId ? { storeId } : {};

  const minPriceDecimal =
    minPrice !== undefined && minPrice > 0
      ? new Prisma.Decimal(String(minPrice))
      : new Prisma.Decimal('0.1');

  const where: Prisma.ProductWhereInput = {
    active: true,
    imageUrl: { not: null },
    productStores: {
      some: {
        ...storeFilter,
        price:
          maxPrice !== undefined && maxPrice <= 50
            ? { gte: minPriceDecimal, lt: new Prisma.Decimal(String(maxPrice)) }
            : { gte: minPriceDecimal },
        stockQuantity: { gt: MIN_PUBLIC_STOCK },
      },
    },
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

export async function upsertProductStore(
  productId: string,
  storeId: string,
  price: number,
  stockQuantity: number,
) {
  return prisma.productStore.upsert({
    create: {
      price: new Prisma.Decimal(String(price)),
      productId,
      stockQuantity,
      storeId,
    },
    update: {
      price: new Prisma.Decimal(String(price)),
      stockQuantity,
    },
    where: { productId_storeId: { productId, storeId } },
  });
}

export async function upsertProductStores(
  productId: string,
  stores: { price: number; stockQuantity: number; storeId: string }[],
) {
  await Promise.all(
    stores.map((s) => upsertProductStore(productId, s.storeId, s.price, s.stockQuantity)),
  );
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
