import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  blogArticle: {
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({ default: prismaMock }));

import {
  createBlogArticle,
  deleteBlogArticle,
  getActiveBlogArticleById,
  getActiveBlogArticlesPaginated,
  getAllBlogArticles,
  getBlogArticleById,
  updateBlogArticle,
} from '../blogArticleService.js';

describe('blogArticleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getActiveBlogArticlesPaginated returns active blogs ordered by createdAt desc', async () => {
    prismaMock.blogArticle.findMany.mockResolvedValue([{ id: 'b1', active: true }]);
    prismaMock.blogArticle.count.mockResolvedValue(1);

    const result = await getActiveBlogArticlesPaginated(1, 9);

    expect(result).toEqual({
      data: [{ id: 'b1', active: true }],
      page: 1,
      pageSize: 9,
      total: 1,
      totalPages: 1,
    });
    expect(prismaMock.blogArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 9,
        where: { active: true },
      }),
    );
  });

  it('getActiveBlogArticleById filters by active', async () => {
    prismaMock.blogArticle.findFirst.mockResolvedValue({ id: 'b1', active: true });
    await getActiveBlogArticleById('b1');
    expect(prismaMock.blogArticle.findFirst).toHaveBeenCalledWith({
      where: { active: true, id: 'b1' },
    });
  });

  it('createBlogArticle, updateBlogArticle and deleteBlogArticle delegate to prisma', async () => {
    prismaMock.blogArticle.create.mockResolvedValue({ id: 'new' });
    prismaMock.blogArticle.update.mockResolvedValue({ id: 'b1' });
    prismaMock.blogArticle.delete.mockResolvedValue({ id: 'b1' });

    await createBlogArticle({ active: true, content: '<p>x</p>', title: 'T' });
    await updateBlogArticle('b1', { active: false });
    await deleteBlogArticle('b1');

    expect(prismaMock.blogArticle.create).toHaveBeenCalled();
    expect(prismaMock.blogArticle.update).toHaveBeenCalled();
    expect(prismaMock.blogArticle.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
  });

  it('getAllBlogArticles and getBlogArticleById work', async () => {
    prismaMock.blogArticle.findMany.mockResolvedValue([]);
    prismaMock.blogArticle.findUnique.mockResolvedValue(null);
    expect(await getAllBlogArticles()).toEqual([]);
    expect(await getBlogArticleById('x')).toBeNull();
  });
});
