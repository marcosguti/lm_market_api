import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  deal: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({ default: prismaMock }));

import {
  createDeal,
  deleteDeal,
  getActiveDeals,
  getAllDeals,
  getDealById,
  updateDeal,
} from '../dealService.js';

describe('dealService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getActiveDeals returns image URLs for current deals', async () => {
    prismaMock.deal.findMany.mockResolvedValue([{ imageUrl: 'https://deal.test/1.jpg' }]);
    const result = await getActiveDeals();
    expect(result).toEqual(['https://deal.test/1.jpg']);
    expect(prismaMock.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
  });

  it('createDeal delegates to prisma', async () => {
    const now = new Date();
    prismaMock.deal.create.mockResolvedValue({ id: 'd1' });
    const result = await createDeal({
      endDate: now,
      imageUrl: 'https://deal.test/1.jpg',
      startDate: now,
    });
    expect(result.id).toBe('d1');
  });

  it('updateDeal and deleteDeal call prisma', async () => {
    prismaMock.deal.update.mockResolvedValue({ id: 'd1' });
    prismaMock.deal.delete.mockResolvedValue({ id: 'd1' });
    await updateDeal('d1', { description: 'Updated' });
    await deleteDeal('d1');
    expect(prismaMock.deal.update).toHaveBeenCalled();
    expect(prismaMock.deal.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });

  it('getAllDeals and getDealById work', async () => {
    prismaMock.deal.findMany.mockResolvedValue([]);
    prismaMock.deal.findUnique.mockResolvedValue(null);
    expect(await getAllDeals()).toEqual([]);
    expect(await getDealById('x')).toBeNull();
  });
});
