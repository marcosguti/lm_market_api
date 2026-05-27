import type { ProductWithRelations } from '../queries/product.js';

export function productBrandName(p: ProductWithRelations): string {
  return p.brandRef?.name ?? p.brand;
}

export function productDepartmentName(p: ProductWithRelations): string {
  return p.departmentRef?.name ?? p.department;
}
