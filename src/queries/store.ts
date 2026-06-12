import { Prisma } from '@prisma/client';

import prisma from '../prisma.js';

export async function findStores(): Promise<Prisma.StoreGetPayload<Record<string, never>>[]> {
  return prisma.store.findMany({ orderBy: { name: 'asc' } });
}
