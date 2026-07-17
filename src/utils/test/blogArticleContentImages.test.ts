import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteFile = vi.fn();
const uploadBlogArticleContentImage = vi.fn();

vi.mock('../../libs/filesInDigitalOcean/index.js', () => ({
  deleteFile: (...args: unknown[]) => deleteFile(...args),
  uploadBlogArticleContentImage: (...args: unknown[]) => uploadBlogArticleContentImage(...args),
}));

vi.mock('uuid', () => ({
  v4: () => 'uuid-1',
}));

import {
  deleteAllContentImages,
  deleteRemovedContentImages,
  extractImageSrcs,
  uploadAndReplaceContentImages,
} from '../blogArticleContentImages.js';

describe('blogArticleContentImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extractImageSrcs returns img sources', () => {
    const html = '<p>Hi</p><img src="https://cdn/a.jpg" /><img src="data:image/png;base64,xx" />';
    expect(extractImageSrcs(html)).toEqual(['https://cdn/a.jpg', 'data:image/png;base64,xx']);
  });

  it('uploadAndReplaceContentImages uploads blog content images and replaces placeholders', async () => {
    uploadBlogArticleContentImage.mockResolvedValue('https://cdn/blog-articles/uuid-1.png');
    const files = [
      {
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
        originalname: 'blog-article-content-image1.png',
      },
      {
        buffer: Buffer.from('other'),
        mimetype: 'image/png',
        originalname: 'attachment.png',
      },
    ];

    const html = await uploadAndReplaceContentImages(
      '<p><img src="blog-article-content-image1.png" /></p>',
      files as never[],
    );

    expect(uploadBlogArticleContentImage).toHaveBeenCalledTimes(1);
    expect(html).toBe('<p><img src="https://cdn/blog-articles/uuid-1.png" /></p>');
  });

  it('deleteRemovedContentImages deletes only missing old urls', async () => {
    deleteFile.mockResolvedValue({});
    await deleteRemovedContentImages(
      '<img src="https://cdn/old.jpg" /><img src="https://cdn/keep.jpg" />',
      '<img src="https://cdn/keep.jpg" />',
    );
    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledWith('https://cdn/old.jpg');
  });

  it('deleteAllContentImages deletes every src', async () => {
    deleteFile.mockResolvedValue({});
    await deleteAllContentImages('<img src="https://cdn/a.jpg" /><img src="https://cdn/b.jpg" />');
    expect(deleteFile).toHaveBeenCalledTimes(2);
  });
});
