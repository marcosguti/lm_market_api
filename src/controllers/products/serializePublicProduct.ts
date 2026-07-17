import type { ProductWithRelations } from '../../queries/product.js';

import { productBrandName, productDepartmentName } from '../../libs/productCatalog.js';

export function serializePublicProduct(p: ProductWithRelations) {
  const storeEntry = p.productStores[0];
  return {
    brand: productBrandName(p),
    brandId: p.brandId,
    code: p.code,
    createdAt: p.createdAt,
    department: productDepartmentName(p),
    departmentId: p.departmentId,
    description: p.description,
    id: p.id,
    imageUrl: p.imageUrl,
    name: p.name,
    price: storeEntry ? Number(storeEntry.price.toString()) : 0,
    stockQuantity: storeEntry ? storeEntry.stockQuantity : null,
    updatedAt: p.updatedAt,
  };
}
