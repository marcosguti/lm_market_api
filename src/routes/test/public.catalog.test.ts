import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { catalogQueryMocks, resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';

const app = createTestApp();

describe('Public catalog routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  it('GET /api/products requires storeId', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/products returns paginated empty list', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ storeId: '4b8975e4-8daf-41f1-8632-230816673665' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('GET /api/brands returns empty list', async () => {
    const res = await request(app).get('/api/brands');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/departments returns empty list', async () => {
    const res = await request(app).get('/api/departments');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/stores returns empty list', async () => {
    const res = await request(app).get('/api/stores');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/stores returns only active stores from findStores', async () => {
    catalogQueryMocks.findStores.mockResolvedValue([
      {
        city: 'merida',
        externalBranchCode: '1',
        id: 's1',
        latitude: 8.598136,
        longitude: -71.150426,
        name: 'Active Store',
      },
    ]);
    const res = await request(app).get('/api/stores');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        city: 'merida',
        externalBranchCode: '1',
        id: 's1',
        latitude: 8.598136,
        longitude: -71.150426,
        name: 'Active Store',
      },
    ]);
  });

  it('GET /api/products rejects inactive storeId', async () => {
    const { StoreNotFoundError } = await import('../../queries/store.js');
    catalogQueryMocks.assertStoreActive.mockRejectedValue(new StoreNotFoundError());
    const res = await request(app)
      .get('/api/products')
      .query({ storeId: '4b8975e4-8daf-41f1-8632-230816673665' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('STORE_NOT_FOUND');
  });

  it('GET /api/banners returns empty list', async () => {
    const res = await request(app).get('/api/banners');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/deals returns empty list', async () => {
    const res = await request(app).get('/api/deals');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/payments/banks returns bank list', async () => {
    const res = await request(app).get('/api/payments/banks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.banks)).toBe(true);
    expect(res.body.banks.length).toBeGreaterThan(0);
  });
});
