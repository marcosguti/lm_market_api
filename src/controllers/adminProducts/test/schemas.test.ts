import { describe, expect, it } from 'vitest';

import { normalizeAdminProductMultipartBody, patchSchema } from '../schemas.js';

describe('normalizeAdminProductMultipartBody', () => {
  it('parses stores JSON string into an array', () => {
    const body = normalizeAdminProductMultipartBody({
      brand: 'Brand',
      stores: JSON.stringify([
        { storeId: 's1', price: 13.53, stockQuantity: 8 },
        { storeId: 's2', price: 13.53, stockQuantity: 32 },
      ]),
    });
    expect(body.stores).toEqual([
      { storeId: 's1', price: 13.53, stockQuantity: 8 },
      { storeId: 's2', price: 13.53, stockQuantity: 32 },
    ]);
  });

  it('coerces active string to boolean', () => {
    expect(normalizeAdminProductMultipartBody({ active: 'true' }).active).toBe(true);
    expect(normalizeAdminProductMultipartBody({ active: 'false' }).active).toBe(false);
  });

  it('leaves stores array untouched', () => {
    const stores = [{ storeId: 's1', price: 1, stockQuantity: 2 }];
    const body = normalizeAdminProductMultipartBody({ stores });
    expect(body.stores).toEqual(stores);
  });
});

describe('patchSchema with multipart stores', () => {
  it('accepts stores after multipart normalization', () => {
    const body = normalizeAdminProductMultipartBody({
      brand: '---',
      description: '0 CALORIAS',
      stores: JSON.stringify([{ storeId: 's1', price: 13.53, stockQuantity: 8 }]),
    });
    const { error, value } = patchSchema.validate(body);
    expect(error).toBeUndefined();
    expect(value.stores).toHaveLength(1);
    expect(value.stores[0].storeId).toBe('s1');
  });

  it('rejects stores JSON string without normalization', () => {
    const { error } = patchSchema.validate({
      stores: JSON.stringify([{ storeId: 's1', price: 1, stockQuantity: 1 }]),
    });
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/array/i);
  });
});
