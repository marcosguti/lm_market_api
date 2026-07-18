import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  store: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({ default: prismaMock }));

import {
  assertStoreActive,
  assertStoreIdsActive,
  findStores,
  StoreNotFoundError,
} from '../store.js';

describe('store queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findStores returns only active stores ordered by name', async () => {
    prismaMock.store.findMany.mockResolvedValue([
      {
        externalBranchCode: '1',
        id: 's1',
        latitude: null,
        longitude: null,
        name: 'Main',
      },
    ]);
    const result = await findStores();
    expect(result).toHaveLength(1);
    expect(prismaMock.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
        select: {
          city: true,
          externalBranchCode: true,
          id: true,
          latitude: true,
          longitude: true,
          name: true,
        },
        where: { active: true },
      }),
    );
  });

  it('assertStoreActive throws when store is missing or inactive', async () => {
    prismaMock.store.findFirst.mockResolvedValue(null);
    await expect(assertStoreActive('s-inactive')).rejects.toBeInstanceOf(StoreNotFoundError);
    expect(prismaMock.store.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { active: true, id: 's-inactive' },
    });
  });

  it('assertStoreIdsActive throws when any id is inactive', async () => {
    prismaMock.store.count.mockResolvedValue(1);
    await expect(assertStoreIdsActive(['s1', 's2'])).rejects.toBeInstanceOf(StoreNotFoundError);
  });

  it('assertStoreIdsActive resolves when all ids are active', async () => {
    prismaMock.store.count.mockResolvedValue(2);
    await expect(assertStoreIdsActive(['s1', 's2'])).resolves.toBeUndefined();
  });
});
