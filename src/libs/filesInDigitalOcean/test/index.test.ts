import { beforeEach, describe, expect, it, vi } from 'vitest';

const s3Send = vi.hoisted(() => vi.fn());

vi.hoisted(() => {
  vi.stubEnv('DIGITAL_OCEAN_BUCKET', 'test-bucket');
  vi.stubEnv('DIGITAL_OCEAN_URL', 'https://cdn.test.com/');
  vi.stubEnv('DIGITAL_OCEAN_SPACES_KEY', 'key');
  vi.stubEnv('DIGITAL_OCEAN_SPACES_SECRET', 'secret');
});

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: vi.fn((input: unknown) => ({ input, type: 'DeleteObjectCommand' })),
  ListObjectsV2Command: vi.fn((input: unknown) => ({ input, type: 'ListObjectsV2Command' })),
  PutObjectCommand: vi.fn((input: unknown) => ({ input, type: 'PutObjectCommand' })),
  S3: vi.fn(() => ({ send: s3Send })),
}));

import {
  buildPublicObjectUrl,
  deleteFile,
  listImageObjectKeys,
  uploadBannerImage,
  uploadBlogArticleContentImage,
  uploadBuffer,
  uploadDealImage,
  uploadDeliveryProof,
  uploadFile,
  uploadPaymentScreenshot,
} from '../index.js';

describe('filesInDigitalOcean', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s3Send.mockResolvedValue({});
  });

  describe('buildPublicObjectUrl', () => {
    it('builds public URL from key', () => {
      expect(buildPublicObjectUrl('images/photo.jpg')).toBe(
        'https://cdn.test.com/images/photo.jpg',
      );
    });
  });

  describe('uploadBuffer', () => {
    it('uploads buffer and returns public URL', async () => {
      const url = await uploadBuffer({
        buffer: Buffer.from('data'),
        contentType: 'image/jpeg',
        extension: 'jpg',
        fileName: 'abc',
      });

      expect(s3Send).toHaveBeenCalledWith(expect.objectContaining({ type: 'PutObjectCommand' }));
      expect(url).toBe('https://cdn.test.com/images/abc.jpg');
    });

    it('propagates SDK errors', async () => {
      s3Send.mockRejectedValue(new Error('S3 down'));
      await expect(
        uploadBuffer({
          buffer: Buffer.from('data'),
          contentType: 'image/jpeg',
          extension: 'jpg',
          fileName: 'abc',
        }),
      ).rejects.toThrow('S3 down');
    });
  });

  describe('uploadFile', () => {
    it('uploads multer file using original extension', async () => {
      const url = await uploadFile(
        {
          buffer: Buffer.from('data'),
          mimetype: 'image/png',
          originalname: 'photo.png',
        },
        'file-id',
      );

      expect(url).toBe('https://cdn.test.com/images/file-id.png');
    });
  });

  describe('uploadPaymentScreenshot', () => {
    it('uploads to payments prefix', async () => {
      const url = await uploadPaymentScreenshot(Buffer.from('img'), 'image/jpeg', 'jpg', 'pay1');
      expect(url).toBe('https://cdn.test.com/payments/pay1.jpg');
    });
  });

  describe('uploadDeliveryProof', () => {
    it('uploads to delivery prefix', async () => {
      const url = await uploadDeliveryProof(Buffer.from('img'), 'image/jpeg', 'jpg', 'proof1');
      expect(url).toBe('https://cdn.test.com/delivery/proof1.jpg');
    });
  });

  describe('uploadDealImage', () => {
    it('uploads to deals prefix', async () => {
      const url = await uploadDealImage(Buffer.from('img'), 'image/jpeg', 'jpg', 'deal1');
      expect(url).toBe('https://cdn.test.com/deals/deal1.jpg');
    });
  });

  describe('uploadBannerImage', () => {
    it('uploads to banner prefix', async () => {
      const url = await uploadBannerImage(Buffer.from('img'), 'image/jpeg', 'jpg', 'banner1');
      expect(url).toBe('https://cdn.test.com/banner/banner1.jpg');
    });
  });

  describe('uploadBlogArticleContentImage', () => {
    it('uploads to blogs prefix', async () => {
      const url = await uploadBlogArticleContentImage(
        Buffer.from('img'),
        'image/jpeg',
        'jpg',
        'blog1',
      );
      expect(url).toBe('https://cdn.test.com/blog-articles/blog1.jpg');
    });
  });

  describe('deleteFile', () => {
    it('deletes object by URL key', async () => {
      s3Send.mockResolvedValue({ DeleteMarker: true });
      const result = await deleteFile('https://cdn.test.com/images/old.jpg');
      expect(s3Send).toHaveBeenCalledWith(expect.objectContaining({ type: 'DeleteObjectCommand' }));
      expect(result).toEqual({ DeleteMarker: true });
    });

    it('returns error object instead of throwing', async () => {
      const err = new Error('not found');
      s3Send.mockRejectedValue(err);
      const result = await deleteFile('https://cdn.test.com/images/missing.jpg');
      expect(result).toBe(err);
    });
  });

  describe('listImageObjectKeys', () => {
    it('lists image keys with pagination', async () => {
      s3Send
        .mockResolvedValueOnce({
          Contents: [{ Key: 'images/a.jpg' }, { Key: 'images/' }],
          IsTruncated: true,
          NextContinuationToken: 'token1',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'images/b.jpg' }],
          IsTruncated: false,
        });

      const keys = await listImageObjectKeys();

      expect(keys).toEqual(['images/a.jpg', 'images/b.jpg']);
      expect(s3Send).toHaveBeenCalledTimes(2);
    });
  });
});
