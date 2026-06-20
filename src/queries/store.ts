import { Prisma } from '@prisma/client';

import prisma from '../prisma.js';

export async function findStores(): Promise<
  Prisma.StoreGetPayload<{ select: { externalBranchCode: true; id: true; name: true } }>[]
> {
  return prisma.store.findMany({
    orderBy: { name: 'asc' },
    select: { externalBranchCode: true, id: true, name: true },
  });
}
