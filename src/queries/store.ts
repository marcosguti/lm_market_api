import { Prisma } from '@prisma/client';

import prisma from '../prisma.js';

export type StoreListItem = Prisma.StoreGetPayload<{
  select: {
    city: true;
    externalBranchCode: true;
    id: true;
    latitude: true;
    longitude: true;
    name: true;
  };
}>;

export type StoreListItemSerialized = {
  city: null | string;
  externalBranchCode: string;
  id: string;
  latitude: null | number;
  longitude: null | number;
  name: string;
};

export class StoreNotFoundError extends Error {
  readonly code = 'STORE_NOT_FOUND';
  readonly statusCode = 400;

  constructor(message = 'Tienda no encontrada') {
    super(message);
  }
}

export async function assertStoreActive(storeId: string): Promise<void> {
  const store = await prisma.store.findFirst({
    select: { id: true },
    where: { active: true, id: storeId },
  });
  if (!store) {
    throw new StoreNotFoundError();
  }
}

export async function assertStoreIdsActive(storeIds: string[]): Promise<void> {
  const unique = [...new Set(storeIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const count = await prisma.store.count({
    where: { active: true, id: { in: unique } },
  });
  if (count !== unique.length) {
    throw new StoreNotFoundError();
  }
}

export async function findStores(): Promise<StoreListItem[]> {
  return prisma.store.findMany({
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
  });
}

export function serializeStore(store: StoreListItem): StoreListItemSerialized {
  return {
    city: store.city ?? null,
    externalBranchCode: store.externalBranchCode,
    id: store.id,
    latitude: decimalToNumber(store.latitude),
    longitude: decimalToNumber(store.longitude),
    name: store.name,
  };
}

function decimalToNumber(value: null | Prisma.Decimal | undefined): null | number {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
