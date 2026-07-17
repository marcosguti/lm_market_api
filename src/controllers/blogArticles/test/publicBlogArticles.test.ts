import type { Request, Response } from 'express';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActiveBlogArticlesPaginated = vi.fn();
const getActiveBlogArticleById = vi.fn();

vi.mock('../../../services/blogArticleService.js', () => ({
  getActiveBlogArticleById: (...args: unknown[]) => getActiveBlogArticleById(...args),
  getActiveBlogArticlesPaginated: (...args: unknown[]) => getActiveBlogArticlesPaginated(...args),
}));

import { getPublicBlogArticleById } from '../getById.js';
import { listPublicBlogArticles } from '../list.js';

function mockRes() {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
}

describe('public blogs controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listPublicBlogArticles returns paginated active blogs', async () => {
    getActiveBlogArticlesPaginated.mockResolvedValue({
      data: [{ id: 'b1', title: 'Post' }],
      page: 1,
      pageSize: 9,
      total: 1,
      totalPages: 1,
    });
    const res = mockRes();
    await listPublicBlogArticles(
      { query: { page: '1', pageSize: '9' } } as unknown as Request,
      res,
    );
    expect(getActiveBlogArticlesPaginated).toHaveBeenCalledWith(1, 9);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 9, total: 1 }),
    );
  });

  it('getPublicBlogArticleById returns 404 when inactive or missing', async () => {
    getActiveBlogArticleById.mockResolvedValue(null);
    const res = mockRes();
    await getPublicBlogArticleById({ params: { id: 'missing' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getPublicBlogArticleById returns active blog', async () => {
    getActiveBlogArticleById.mockResolvedValue({ id: 'b1', title: 'Post', active: true });
    const res = mockRes();
    await getPublicBlogArticleById({ params: { id: 'b1' } } as unknown as Request, res);
    expect(res.json).toHaveBeenCalledWith({
      data: { id: 'b1', title: 'Post', active: true },
    });
  });
});
