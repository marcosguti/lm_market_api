import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../../prisma.js', () => ({
  default: {
    product: {
      count: prismaMocks.count,
      create: prismaMocks.create,
      findMany: prismaMocks.findMany,
      findUnique: prismaMocks.findUnique,
      update: prismaMocks.update,
    },
    productStore: {
      upsert: prismaMocks.upsert,
    },
  },
}));

import {
  createProduct,
  findProductsPaginated,
  upsertProductStore,
  upsertProductStores,
} from '../product.js';

describe('product queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.findMany.mockResolvedValue([]);
    prismaMocks.count.mockResolvedValue(0);
  });

  it('createProduct creates with relations include', async () => {
    prismaMocks.create.mockResolvedValue({ id: 'p1' });
    await createProduct({ name: 'Test', code: 'T1', brand: 'B', department: 'D' } as never);
    expect(prismaMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.any(Object) }),
    );
  });

  it('findProductsPaginated applies search filter', async () => {
    await findProductsPaginated({ page: 1, pageSize: 10, search: 'leche' });
    expect(prismaMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ name: expect.any(Object) })]),
        }),
      }),
    );
  });

  it('upsertProductStore creates or updates store pricing', async () => {
    prismaMocks.upsert.mockResolvedValue({ id: 'ps1' });
    await upsertProductStore('p1', 's1', 9.99, 20);
    expect(prismaMocks.upsert).toHaveBeenCalledWith({
      create: {
        price: new Prisma.Decimal('9.99'),
        productId: 'p1',
        stockQuantity: 20,
        storeId: 's1',
      },
      update: {
        price: new Prisma.Decimal('9.99'),
        stockQuantity: 20,
      },
      where: { productId_storeId: { productId: 'p1', storeId: 's1' } },
    });
  });

  it('upsertProductStores upserts all stores in parallel', async () => {
    prismaMocks.upsert.mockResolvedValue({});
    await upsertProductStores('p1', [
      { storeId: 's1', price: 10, stockQuantity: 5 },
      { storeId: 's2', price: 11, stockQuantity: 3 },
    ]);
    expect(prismaMocks.upsert).toHaveBeenCalledTimes(2);
  });
});
