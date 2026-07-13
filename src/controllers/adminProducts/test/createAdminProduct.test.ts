import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';

const findProductByCode = vi.fn();
const createProduct = vi.fn();
const findProductById = vi.fn();
const upsertProductStores = vi.fn();
const findOrCreateBrand = vi.fn();
const findOrCreateDepartment = vi.fn();
const findStores = vi.fn();
const uploadFile = vi.fn();

vi.mock('../../../queries/product.js', () => ({
  createProduct: (...args: unknown[]) => createProduct(...args),
  findProductByCode: (...args: unknown[]) => findProductByCode(...args),
  findProductById: (...args: unknown[]) => findProductById(...args),
  upsertProductStores: (...args: unknown[]) => upsertProductStores(...args),
}));

vi.mock('../../../queries/brandDepartment.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../queries/brandDepartment.js')>();
  return {
    ...actual,
    findOrCreateBrand: (...args: unknown[]) => findOrCreateBrand(...args),
    findOrCreateDepartment: (...args: unknown[]) => findOrCreateDepartment(...args),
  };
});

vi.mock('../../../queries/store.js', () => ({
  findStores: (...args: unknown[]) => findStores(...args),
}));

vi.mock('../../../libs/filesInDigitalOcean/index.js', () => ({
  uploadFile: (...args: unknown[]) => uploadFile(...args),
}));

import { createAdminProduct } from '../createAdminProduct.js';

const validBody = {
  active: true,
  brand: 'Brand',
  code: 'NEW-001',
  department: 'Dept',
  description: 'Optional',
  name: 'Product Name',
};

function makeRefreshedProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-new',
    code: 'NEW-001',
    name: 'Product Name',
    active: true,
    brand: 'Brand',
    brandId: 'b1',
    brandRef: { id: 'b1', name: 'Brand' },
    department: 'Dept',
    departmentId: 'd1',
    departmentRef: { id: 'd1', name: 'Dept' },
    description: 'Optional',
    imageUrl: null,
    productStores: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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

describe('createAdminProduct controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findProductByCode.mockResolvedValue(null);
    findOrCreateBrand.mockResolvedValue({ id: 'b1', name: 'Brand' });
    findOrCreateDepartment.mockResolvedValue({ id: 'd1', name: 'Dept' });
    createProduct.mockResolvedValue({ id: 'p-new' });
    findStores.mockResolvedValue([
      { id: 's1', name: 'Store 1' },
      { id: 's2', name: 'Store 2' },
    ]);
    findProductById.mockResolvedValue(makeRefreshedProduct());
    upsertProductStores.mockResolvedValue(undefined);
    uploadFile.mockResolvedValue('https://cdn.example/product.jpg');
  });

  it('returns 201 and seeds all stores when stores are omitted', async () => {
    const req = { body: validBody } as AuthRequest;
    const res = mockRes();

    await createAdminProduct(req, res);

    expect(res.statusCode).toBe(201);
    expect(findStores).toHaveBeenCalled();
    expect(upsertProductStores).toHaveBeenCalledWith('p-new', [
      { price: 0, stockQuantity: 0, storeId: 's1' },
      { price: 0, stockQuantity: 0, storeId: 's2' },
    ]);
    expect(res.body).toMatchObject({ product: expect.objectContaining({ code: 'NEW-001' }) });
  });

  it('returns 201 and uses explicit stores when provided', async () => {
    const req = {
      body: {
        ...validBody,
        stores: [{ storeId: 's1', price: 9.99, stockQuantity: 15 }],
      },
    } as AuthRequest;
    const res = mockRes();

    await createAdminProduct(req, res);

    expect(res.statusCode).toBe(201);
    expect(upsertProductStores).toHaveBeenCalledWith('p-new', [
      { storeId: 's1', price: 9.99, stockQuantity: 15 },
    ]);
  });

  it('returns 201 and uploads image when file is attached', async () => {
    const req = {
      body: validBody,
      file: {
        buffer: Buffer.from('image'),
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      },
    } as AuthRequest;
    const res = mockRes();

    await createAdminProduct(req, res);

    expect(res.statusCode).toBe(201);
    expect(uploadFile).toHaveBeenCalled();
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: 'https://cdn.example/product.jpg' }),
    );
  });

  it('returns 500 when product creation fails', async () => {
    createProduct.mockRejectedValue(new Error('db'));
    const req = { body: validBody } as AuthRequest;
    const res = mockRes();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await createAdminProduct(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear el producto' });
    errorSpy.mockRestore();
  });
});
