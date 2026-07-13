import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  banner: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({ default: prismaMock }));

import {
  createBanner,
  deleteBanner,
  getActiveBanners,
  getAllBanners,
  getBannerById,
  updateBanner,
} from '../bannerService.js';

describe('bannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getActiveBanners returns active banners ordered by createdAt desc', async () => {
    prismaMock.banner.findMany.mockResolvedValue([{ id: 'b1', active: true }]);
    const result = await getActiveBanners();
    expect(result).toHaveLength(1);
    expect(prismaMock.banner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });

  it('createBanner delegates to prisma', async () => {
    prismaMock.banner.create.mockResolvedValue({ id: 'new' });
    const result = await createBanner({
      active: true,
      description: 'Promo',
      imageUrl: 'https://img.test/b.jpg',
    });
    expect(result.id).toBe('new');
  });

  it('updateBanner and deleteBanner call prisma', async () => {
    prismaMock.banner.update.mockResolvedValue({ id: 'b1' });
    prismaMock.banner.delete.mockResolvedValue({ id: 'b1' });
    await updateBanner('b1', { active: false });
    await deleteBanner('b1');
    expect(prismaMock.banner.update).toHaveBeenCalled();
    expect(prismaMock.banner.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
  });

  it('getAllBanners and getBannerById work', async () => {
    prismaMock.banner.findMany.mockResolvedValue([]);
    prismaMock.banner.findUnique.mockResolvedValue(null);
    expect(await getAllBanners()).toEqual([]);
    expect(await getBannerById('x')).toBeNull();
  });
});
