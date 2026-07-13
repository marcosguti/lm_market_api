import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { authHeader, mockAuthenticatedUser } from './helpers/authHelpers.js';
import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import {
  getProductQueryMocks,
  resetQueryMocks,
  bannerServiceMocks,
  catalogQueryMocks,
  dealServiceMocks,
} from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';

const app = createTestApp();

describe('Admin business routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
    mockAuthenticatedUser('admin-1', 'admin');
  });

  describe('POST /api/admin/products', () => {
    it('returns 400 for invalid body', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set(authHeader())
        .send({ code: 'X' });
      expect(res.status).toBe(400);
    });

    it('returns 409 when product code already exists', async () => {
      getProductQueryMocks().findProductByCode.mockResolvedValue({ id: 'existing' });
      const res = await request(app).post('/api/admin/products').set(authHeader()).send({
        brand: 'Brand',
        code: 'DUP',
        department: 'Dept',
        name: 'Product',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/código/i);
    });

    it('returns 201 and creates product on success', async () => {
      catalogQueryMocks.findStores.mockResolvedValue([{ id: 's1', name: 'Store 1' }]);
      getProductQueryMocks().findProductById.mockResolvedValue({
        id: 'p-new',
        code: 'NEW-002',
        name: 'New Product',
        active: true,
        brand: 'Brand',
        brandId: 'b-new',
        brandRef: { id: 'b-new', name: 'Brand' },
        department: 'Dept',
        departmentId: 'd-new',
        departmentRef: { id: 'd-new', name: 'Dept' },
        description: null,
        imageUrl: null,
        productStores: [
          {
            productId: 'p-new',
            storeId: 's1',
            price: { toString: () => '0' },
            stockQuantity: 0,
            store: { id: 's1', name: 'Store 1' },
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).post('/api/admin/products').set(authHeader()).send({
        brand: 'Brand',
        code: 'NEW-002',
        department: 'Dept',
        name: 'New Product',
      });

      expect(res.status).toBe(201);
      expect(getProductQueryMocks().createProduct).toHaveBeenCalled();
      expect(getProductQueryMocks().upsertProductStores).toHaveBeenCalled();
      expect(res.body.product.code).toBe('NEW-002');
    });
  });

  describe('PATCH /api/admin/products/:id', () => {
    it('returns 404 when product does not exist', async () => {
      getProductQueryMocks().findProductById.mockResolvedValue(null);
      const res = await request(app)
        .patch('/api/admin/products/missing')
        .set(authHeader())
        .send({ description: 'Updated desc' });
      expect(res.status).toBe(404);
    });

    it('updates product description on success', async () => {
      getProductQueryMocks().findProductById.mockResolvedValue({
        id: 'p1',
        code: 'X',
        name: 'Old',
        active: true,
        brand: 'B',
        brandId: 'b1',
        department: 'D',
        departmentId: 'd1',
        description: null,
        imageUrl: null,
        productStores: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await request(app)
        .patch('/api/admin/products/p1')
        .set(authHeader())
        .send({ description: 'Updated desc' });
      expect(res.status).toBe(200);
      expect(getProductQueryMocks().updateProductById).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/admin/products/:id', () => {
    it('returns 404 when product does not exist', async () => {
      getProductQueryMocks().findProductById.mockResolvedValue(null);
      const res = await request(app).delete('/api/admin/products/missing').set(authHeader());
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/banners', () => {
    it('returns 400 when image file is missing', async () => {
      const res = await request(app)
        .post('/api/admin/banners')
        .set(authHeader())
        .field('active', 'true');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/imagen/i);
    });

    it('creates banner with image upload', async () => {
      bannerServiceMocks.createBanner.mockResolvedValue({
        id: 'b-new',
        active: true,
        imageUrl: 'https://cdn.example/banner.jpg',
        description: null,
      });

      const res = await request(app)
        .post('/api/admin/banners')
        .set(authHeader())
        .field('active', 'true')
        .attach('image', Buffer.from('fake-image'), {
          filename: 'banner.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      expect(bannerServiceMocks.createBanner).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/banners/:id', () => {
    it('returns 404 when banner does not exist', async () => {
      bannerServiceMocks.getBannerById.mockResolvedValue(null);
      const res = await request(app)
        .patch('/api/admin/banners/missing')
        .set(authHeader())
        .field('description', 'Updated');
      expect(res.status).toBe(404);
    });

    it('updates banner description', async () => {
      bannerServiceMocks.getBannerById.mockResolvedValue({
        id: 'b1',
        active: true,
        imageUrl: 'https://cdn/x.jpg',
        description: null,
      });
      bannerServiceMocks.updateBanner.mockResolvedValue({
        id: 'b1',
        active: true,
        imageUrl: 'https://cdn/x.jpg',
        description: 'Updated',
      });
      const res = await request(app)
        .patch('/api/admin/banners/b1')
        .set(authHeader())
        .field('description', 'Updated');
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/admin/banners/:id', () => {
    it('returns 404 when banner missing', async () => {
      bannerServiceMocks.getBannerById.mockResolvedValue(null);
      const res = await request(app).delete('/api/admin/banners/missing').set(authHeader());
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/deals', () => {
    it('returns 400 when image is missing', async () => {
      const res = await request(app)
        .post('/api/admin/deals')
        .set(authHeader())
        .field('startDate', '2026-07-01')
        .field('endDate', '2026-08-01');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/deals/:id', () => {
    it('returns 404 when deal missing', async () => {
      dealServiceMocks.getDealById.mockResolvedValue(null);
      const res = await request(app)
        .patch('/api/admin/deals/missing')
        .set(authHeader())
        .field('description', 'Promo');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/products/:id extended', () => {
    it('updates brand and stores', async () => {
      getProductQueryMocks()
        .findProductById.mockResolvedValueOnce({
          id: 'p1',
          code: 'X',
          name: 'Old',
          active: true,
          brand: 'B',
          brandId: 'b1',
          department: 'D',
          departmentId: 'd1',
          description: null,
          imageUrl: null,
          productStores: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'p1',
          code: 'X',
          name: 'Old',
          active: true,
          brand: 'NewBrand',
          brandId: 'b2',
          department: 'D',
          departmentId: 'd1',
          description: null,
          imageUrl: null,
          productStores: [
            { storeId: 's1', price: 10, stockQuantity: 5, store: { id: 's1', name: 'S1' } },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const res = await request(app)
        .patch('/api/admin/products/p1')
        .set(authHeader())
        .send({
          brand: 'NewBrand',
          stores: [{ storeId: 's1', price: 10, stockQuantity: 5 }],
        });
      expect(res.status).toBe(200);
      expect(getProductQueryMocks().updateProductById).toHaveBeenCalled();
    });
  });
});
