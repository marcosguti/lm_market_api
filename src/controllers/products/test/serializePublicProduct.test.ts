import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { ProductWithRelations } from '../../../queries/product.js';
import { serializePublicProduct } from '../serializePublicProduct.js';

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
    imageUrl: 'https://img.test/p1.jpg',
    name: 'Product 1',
    productStores: [
      {
        price: new Prisma.Decimal('12.50'),
        productId: 'p1',
        stockQuantity: 20,
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

describe('serializePublicProduct', () => {
  it('maps product with store price and stockQuantity', () => {
    const result = serializePublicProduct(sampleProduct());

    expect(result.id).toBe('p1');
    expect(result.brand).toBe('Brand A');
    expect(result.department).toBe('Dept A');
    expect(result.price).toBe(12.5);
    expect(result.stockQuantity).toBe(20);
    expect(result).not.toHaveProperty('productStores');
    expect(result).not.toHaveProperty('totalStock');
  });

  it('returns zero price when product has no stores', () => {
    const product = { ...sampleProduct(), productStores: [] };
    const result = serializePublicProduct(product);

    expect(result.price).toBe(0);
    expect(result.stockQuantity).toBeNull();
    expect(result).not.toHaveProperty('productStores');
  });
});
