import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';

const getDealById = vi.fn();
const updateDeal = vi.fn();
const deleteDeal = vi.fn();
const uploadDealImage = vi.fn();

vi.mock('../../../services/dealService.js', () => ({
  deleteDeal: (...args: unknown[]) => deleteDeal(...args),
  getDealById: (...args: unknown[]) => getDealById(...args),
  updateDeal: (...args: unknown[]) => updateDeal(...args),
}));

vi.mock('../../../libs/filesInDigitalOcean/index.js', () => ({
  uploadDealImage: (...args: unknown[]) => uploadDealImage(...args),
}));

import { deleteAdminDeal } from '../delete.js';
import { patchAdminDeal } from '../patch.js';

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

describe('adminDeals controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadDealImage.mockResolvedValue('https://cdn/deal.jpg');
  });

  describe('patchAdminDeal', () => {
    it('returns 404 when deal does not exist', async () => {
      getDealById.mockResolvedValue(null);
      const req = { params: { id: 'missing' }, body: {} } as unknown as AuthRequest;
      const res = mockRes();
      await patchAdminDeal(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('updates deal dates on success', async () => {
      getDealById.mockResolvedValue({
        id: 'd1',
        imageUrl: 'old.jpg',
        startDate: new Date(),
        endDate: new Date(),
      });
      updateDeal.mockResolvedValue({ id: 'd1' });
      const req = {
        params: { id: 'd1' },
        body: { description: 'Promo' },
      } as unknown as AuthRequest;
      const res = mockRes();
      await patchAdminDeal(req, res);
      expect(res.statusCode).toBe(200);
      expect(updateDeal).toHaveBeenCalled();
    });
  });

  describe('deleteAdminDeal', () => {
    it('returns 404 when deal missing', async () => {
      getDealById.mockResolvedValue(null);
      const req = { params: { id: 'missing' } } as unknown as AuthRequest;
      const res = mockRes();
      await deleteAdminDeal(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('deletes deal on success', async () => {
      getDealById.mockResolvedValue({ id: 'd1' });
      deleteDeal.mockResolvedValue(undefined);
      const req = { params: { id: 'd1' } } as unknown as AuthRequest;
      const res = mockRes();
      await deleteAdminDeal(req, res);
      expect(res.statusCode).toBe(200);
      expect(deleteDeal).toHaveBeenCalledWith('d1');
    });
  });
});
