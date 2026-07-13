import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';

const getBannerById = vi.fn();
const updateBanner = vi.fn();
const deleteBanner = vi.fn();
const uploadBannerImage = vi.fn();

vi.mock('../../../services/bannerService.js', () => ({
  deleteBanner: (...args: unknown[]) => deleteBanner(...args),
  getBannerById: (...args: unknown[]) => getBannerById(...args),
  updateBanner: (...args: unknown[]) => updateBanner(...args),
}));

vi.mock('../../../libs/filesInDigitalOcean/index.js', () => ({
  uploadBannerImage: (...args: unknown[]) => uploadBannerImage(...args),
}));

import { deleteAdminBanner } from '../delete.js';
import { patchAdminBanner } from '../patch.js';

function mockRes(): Response & { statusCode: number; body?: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body?: unknown };
}

describe('adminBanners controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadBannerImage.mockResolvedValue('https://cdn/banner.jpg');
  });

  describe('patchAdminBanner', () => {
    it('returns 404 when banner does not exist', async () => {
      getBannerById.mockResolvedValue(null);
      const req = { params: { id: 'missing' }, body: {} } as unknown as AuthRequest;
      const res = mockRes();
      await patchAdminBanner(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('updates banner description on success', async () => {
      getBannerById.mockResolvedValue({ id: 'b1', imageUrl: 'old.jpg', active: true });
      updateBanner.mockResolvedValue({ id: 'b1', description: 'New', active: true });
      const req = {
        params: { id: 'b1' },
        body: { description: 'New' },
      } as unknown as AuthRequest;
      const res = mockRes();
      await patchAdminBanner(req, res);
      expect(res.statusCode).toBe(200);
      expect(updateBanner).toHaveBeenCalledWith('b1', { description: 'New' });
    });

    it('returns 400 for invalid active boolean', async () => {
      getBannerById.mockResolvedValue({ id: 'b1', imageUrl: 'old.jpg', active: true });
      const req = {
        params: { id: 'b1' },
        body: { active: 'maybe' },
      } as unknown as AuthRequest;
      const res = mockRes();
      await patchAdminBanner(req, res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('deleteAdminBanner', () => {
    it('returns 404 when banner missing', async () => {
      getBannerById.mockResolvedValue(null);
      const req = { params: { id: 'missing' } } as unknown as AuthRequest;
      const res = mockRes();
      await deleteAdminBanner(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('deletes banner on success', async () => {
      getBannerById.mockResolvedValue({ id: 'b1' });
      deleteBanner.mockResolvedValue(undefined);
      const req = { params: { id: 'b1' } } as unknown as AuthRequest;
      const res = mockRes();
      await deleteAdminBanner(req, res);
      expect(res.statusCode).toBe(200);
      expect(deleteBanner).toHaveBeenCalledWith('b1');
    });
  });
});
