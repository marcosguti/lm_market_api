import type { Product } from '@prisma/client';

export function serializeAdminProduct(p: Product) {
  return {
    active: p.active,
    adminMovements: p.adminMovements,
    brand: p.brand,
    code: p.code,
    cost: Number(p.cost.toString()),
    createdAt: p.createdAt,
    department: p.department,
    description: p.description,
    id: p.id,
    imageUrl: p.imageUrl,
    initialBalance: p.initialBalance,
    inventoryValueBs:
      p.inventoryValueBs === null || p.inventoryValueBs === undefined
        ? null
        : Number(p.inventoryValueBs.toString()),
    marginPct:
      p.marginPct === null || p.marginPct === undefined ? null : Number(p.marginPct.toString()),
    name: p.name,
    price: Number(p.price.toString()),
    salesToday: p.salesToday,
    totalStock: p.totalStock,
    updatedAt: p.updatedAt,
  };
}
