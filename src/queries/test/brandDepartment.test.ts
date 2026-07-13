import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('../../prisma.js', () => ({
  default: {
    brand: {
      create: prismaMocks.create,
      findFirst: prismaMocks.findFirst,
      findMany: prismaMocks.findMany,
    },
    department: {
      create: prismaMocks.create,
      findFirst: prismaMocks.findFirst,
      findMany: prismaMocks.findMany,
    },
  },
}));

import {
  buildBrandFilter,
  buildDepartmentFilter,
  findAllBrandsForCatalog,
  findAllDepartmentsForCatalog,
  findOrCreateBrand,
  loadBrandNameToIdMap,
  resolveBrandId,
} from '../brandDepartment.js';

describe('brandDepartment queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.findMany.mockResolvedValue([]);
  });

  it('buildBrandFilter returns empty for blank value', () => {
    expect(buildBrandFilter('  ')).toEqual({});
  });

  it('buildBrandFilter uses brandId for UUID values', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(buildBrandFilter(uuid)).toEqual({ brandId: uuid });
  });

  it('buildDepartmentFilter matches department name case-insensitively', () => {
    expect(buildDepartmentFilter('Lácteos')).toEqual({
      OR: expect.arrayContaining([expect.objectContaining({ departmentRef: expect.any(Object) })]),
    });
  });

  it('findOrCreateBrand returns existing brand', async () => {
    prismaMocks.findFirst.mockResolvedValue({ id: 'b1', name: 'Nestle' });
    const brand = await findOrCreateBrand('nestle');
    expect(brand.id).toBe('b1');
    expect(prismaMocks.create).not.toHaveBeenCalled();
  });

  it('findOrCreateBrand creates when missing', async () => {
    prismaMocks.findFirst.mockResolvedValue(null);
    prismaMocks.create.mockResolvedValue({ id: 'b2', name: 'New Brand' });
    const brand = await findOrCreateBrand('New Brand');
    expect(brand.id).toBe('b2');
    expect(prismaMocks.create).toHaveBeenCalled();
  });

  it('findAllBrandsForCatalog queries active product brands', async () => {
    prismaMocks.findMany.mockResolvedValue([{ id: 'b1', name: 'Brand' }]);
    const brands = await findAllBrandsForCatalog();
    expect(brands).toHaveLength(1);
  });

  it('findAllDepartmentsForCatalog queries active product departments', async () => {
    prismaMocks.findMany.mockResolvedValue([{ id: 'd1', name: 'Dept' }]);
    const departments = await findAllDepartmentsForCatalog();
    expect(departments).toHaveLength(1);
  });

  it('loadBrandNameToIdMap builds name to id map', async () => {
    prismaMocks.findMany.mockResolvedValue([
      { id: 'b1', name: 'A' },
      { id: 'b2', name: 'B' },
    ]);
    const map = await loadBrandNameToIdMap();
    expect(map.get('A')).toBe('b1');
    expect(map.get('B')).toBe('b2');
  });

  it('resolveBrandId returns id using cache or creates brand', async () => {
    prismaMocks.findFirst.mockResolvedValue({ id: 'b1', name: 'Nestle' });
    const cache = new Map<string, string>();
    const id = await resolveBrandId('nestle', cache);
    expect(id).toBe('b1');
    expect(cache.get('Nestle')).toBe('b1');
  });
});
