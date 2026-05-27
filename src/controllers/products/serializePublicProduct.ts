import type { ProductWithRelations } from '../../queries/product.js';

import { productBrandName, productDepartmentName } from '../../libs/productCatalog.js';

/** Catálogo público: sin costo, margen ni datos internos de inventario. */
export function serializePublicProduct(p: ProductWithRelations) {
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
    price: Number(p.price.toString()),
    salesToday: p.salesToday,
    totalStock: p.totalStock,
    updatedAt: p.updatedAt,
  };
}
