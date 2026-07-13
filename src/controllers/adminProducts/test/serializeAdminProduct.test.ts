import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { ProductWithRelations } from '../../../queries/product.js';
import { serializeAdminProduct } from '../serializeAdminProduct.js';

function sampleProduct(): ProductWithRelations {
  return {
    active: true,
    brand: 'Legacy Brand',
    brandId: 'b1',
    brandRef: { id: 'b1', name: 'Brand A', createdAt: new Date(), updatedAt: new Date() },
    code: 'SKU1',
    createdAt: new Date('2024-01-01'),
    department: 'Legacy Dept',
    departmentId: 'd1',
    departmentRef: { id: 'd1', name: 'Dept A', createdAt: new Date(), updatedAt: new Date() },
    description: 'Desc',
    id: 'p1',
    imageUrl: null,
    name: 'Product 1',
    productStores: [
      {
        price: new Prisma.Decimal('9.99'),
        productId: 'p1',
        stockQuantity: 5,
        store: {
          id: 's1',
          name: 'Store 1',
          externalBranchCode: '001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        storeId: 's1',
      },
    ],
    updatedAt: new Date('2024-06-01'),
  } as ProductWithRelations;
}

describe('serializeAdminProduct', () => {
  it('includes active flag and admin fields', () => {
    const result = serializeAdminProduct(sampleProduct());

    expect(result.active).toBe(true);
    expect(result.code).toBe('SKU1');
    expect(result.price).toBe(9.99);
    expect(result.brand).toBe('Brand A');
  });
});
