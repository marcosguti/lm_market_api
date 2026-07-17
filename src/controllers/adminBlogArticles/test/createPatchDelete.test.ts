import type { Response } from 'express';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBlogArticle = vi.fn();
const deleteBlogArticle = vi.fn();
const getBlogArticleById = vi.fn();
const updateBlogArticle = vi.fn();
const uploadAndReplaceContentImages = vi.fn();
const deleteRemovedContentImages = vi.fn();
const deleteAllContentImages = vi.fn();

vi.mock('../../../services/blogArticleService.js', () => ({
  createBlogArticle: (...args: unknown[]) => createBlogArticle(...args),
  deleteBlogArticle: (...args: unknown[]) => deleteBlogArticle(...args),
  getBlogArticleById: (...args: unknown[]) => getBlogArticleById(...args),
  updateBlogArticle: (...args: unknown[]) => updateBlogArticle(...args),
}));

vi.mock('../../../utils/blogArticleContentImages.js', () => ({
  deleteAllContentImages: (...args: unknown[]) => deleteAllContentImages(...args),
  deleteRemovedContentImages: (...args: unknown[]) => deleteRemovedContentImages(...args),
  uploadAndReplaceContentImages: (...args: unknown[]) => uploadAndReplaceContentImages(...args),
}));

import { createAdminBlogArticle } from '../create.js';
import { deleteAdminBlogArticle } from '../delete.js';
import { patchAdminBlogArticle } from '../patch.js';

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

describe('adminBlogArticles controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadAndReplaceContentImages.mockImplementation(async (html: string) => html);
    deleteRemovedContentImages.mockResolvedValue(undefined);
    deleteAllContentImages.mockResolvedValue(undefined);
  });

  it('createAdminBlogArticle uploads images and creates blog', async () => {
    createBlogArticle.mockResolvedValue({
      id: 'b1',
      title: 'T',
      content: '<p>ok</p>',
      active: true,
    });
    const res = mockRes();
    await createAdminBlogArticle(
      {
        body: {
          active: 'true',
          content: '<p><img src="blog-article-content-image1.png" /></p>',
          title: 'T',
        },
        files: [
          {
            buffer: Buffer.from('x'),
            mimetype: 'image/png',
            originalname: 'blog-article-content-image1.png',
          },
        ],
      } as never,
      res,
    );

    expect(uploadAndReplaceContentImages).toHaveBeenCalled();
    expect(createBlogArticle).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('patchAdminBlogArticle removes orphaned images when content changes', async () => {
    getBlogArticleById.mockResolvedValue({
      id: 'b1',
      title: 'Old',
      content: '<img src="https://cdn/old.jpg" />',
      active: true,
    });
    updateBlogArticle.mockResolvedValue({
      id: 'b1',
      title: 'New',
      content: '<p>nuevo</p>',
      active: true,
    });
    const res = mockRes();

    await patchAdminBlogArticle(
      {
        body: { content: '<p>nuevo</p>', title: 'New' },
        files: [],
        params: { id: 'b1' },
      } as never,
      res,
    );

    expect(deleteRemovedContentImages).toHaveBeenCalledWith(
      '<img src="https://cdn/old.jpg" />',
      '<p>nuevo</p>',
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('deleteAdminBlogArticle deletes all content images then the blog', async () => {
    getBlogArticleById.mockResolvedValue({
      id: 'b1',
      content: '<img src="https://cdn/a.jpg" />',
    });
    deleteBlogArticle.mockResolvedValue(undefined);
    const res = mockRes();

    await deleteAdminBlogArticle({ params: { id: 'b1' } } as never, res);

    expect(deleteAllContentImages).toHaveBeenCalledWith('<img src="https://cdn/a.jpg" />');
    expect(deleteBlogArticle).toHaveBeenCalledWith('b1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Artículo eliminado' });
  });

  it('patchAdminBlogArticle returns 404 when missing', async () => {
    getBlogArticleById.mockResolvedValue(null);
    const res = mockRes();
    await patchAdminBlogArticle({ body: { title: 'X' }, params: { id: 'missing' } } as never, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
