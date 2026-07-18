import type { ProductWithRelations } from '../../queries/product.js';

import { productBrandName, productDepartmentName } from '../../libs/productCatalog.js';

export function serializeAdminProduct(p: ProductWithRelations) {
  const firstStore = p.productStores[0];
  return {
    active: p.active,
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
    price: firstStore ? Number(firstStore.price.toString()) : 0,
    productStores: p.productStores.map((ps) => ({
      price: Number(ps.price.toString()),
      productId: ps.productId,
      stockQuantity: ps.stockQuantity,
      store: {
        externalBranchCode: ps.store.externalBranchCode,
        id: ps.store.id,
        name: ps.store.name,
      },
      storeId: ps.storeId,
    })),
    totalStock: firstStore ? firstStore.stockQuantity : null,
    updatedAt: p.updatedAt,
  };
}
