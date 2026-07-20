import type { Deal } from '@prisma/client';

import prisma from '../prisma.js';

export interface DealInput {
  active?: boolean;
  description?: null | string;
  endDate: Date;
  imageUrl: string;
  startDate: Date;
}

export interface DealUpdate {
  active?: boolean;
  description?: null | string;
  endDate?: Date;
  imageUrl?: string;
  startDate?: Date;
}

export async function createDeal(data: DealInput): Promise<Deal> {
  return prisma.deal.create({ data });
}

export async function deleteDeal(id: string): Promise<void> {
  await prisma.deal.delete({ where: { id } });
}

export async function getActiveDeals(): Promise<string[]> {
  const today = startOfDay(new Date());
  const endOfToday = endOfDay(new Date());

  const deals = await prisma.deal.findMany({
    orderBy: { startDate: 'desc' },
    select: { imageUrl: true },
    where: {
      active: true,
      endDate: { gte: today },
      startDate: { lte: endOfToday },
    },
  });
  return deals.map((d) => d.imageUrl);
}

export async function getAllDeals(): Promise<Deal[]> {
  return prisma.deal.findMany({
    orderBy: { startDate: 'desc' },
  });
}

export async function getDealById(id: string): Promise<Deal | null> {
  return prisma.deal.findUnique({ where: { id } });
}

export async function updateDeal(id: string, data: DealUpdate): Promise<Deal> {
  return prisma.deal.update({ data, where: { id } });
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}
