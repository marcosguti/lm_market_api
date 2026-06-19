import type { Banner } from '@prisma/client';

import prisma from '../prisma.js';

export interface BannerInput {
  active: boolean;
  description?: null | string;
  imageUrl: string;
}

export interface BannerUpdate {
  active?: boolean;
  description?: null | string;
  imageUrl?: string;
}

export async function createBanner(data: BannerInput): Promise<Banner> {
  return prisma.banner.create({ data });
}

export async function deleteBanner(id: string): Promise<void> {
  await prisma.banner.delete({ where: { id } });
}

export async function getActiveBanners(): Promise<Banner[]> {
  return prisma.banner.findMany({
    orderBy: { createdAt: 'desc' },
    where: { active: true },
  });
}

export async function getAllBanners(): Promise<Banner[]> {
  return prisma.banner.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getBannerById(id: string): Promise<Banner | null> {
  return prisma.banner.findUnique({ where: { id } });
}

export async function updateBanner(id: string, data: BannerUpdate): Promise<Banner> {
  return prisma.banner.update({ data, where: { id } });
}
