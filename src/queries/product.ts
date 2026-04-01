import type { Prisma, Product } from '@prisma/client';

import prisma from '../prisma.js';

export interface FindProductsPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface FindProductsPaginatedResult {
  data: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function findProductsPaginated(
  params: FindProductsPaginatedParams,
): Promise<FindProductsPaginatedResult> {
  const { page, pageSize, search } = params;
  const skip = (page - 1) * pageSize;

  const searchTrim = search?.trim();
  const where: Prisma.ProductWhereInput = {
    // Solo devolver productos con stock disponible mayor a 5 unidades
    totalStock: { gt: 5 },
    ...(searchTrim
      ? {
          OR: [
            { description: { contains: searchTrim, mode: 'insensitive' } },
            { brand: { contains: searchTrim, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: 'asc' },
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
