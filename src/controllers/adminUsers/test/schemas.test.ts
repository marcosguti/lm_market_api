import { describe, expect, it } from 'vitest';

import { createSchema, patchSchema } from '../schemas.js';

const STORE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('adminUsers schemas storeId', () => {
  it('allows admin create without storeId (controller enforces by actor)', () => {
    const result = createSchema.validate({
      email: 'a@test.com',
      firstName: 'A',
      lastName: 'B',
      numberId: '1',
      numberIdType: 'V',
      type: 'admin',
    });
    expect(result.error).toBeUndefined();
  });

  it('allows deliveryDriver create without storeId (admin actor uses req.storeId)', () => {
    const result = createSchema.validate({
      email: 'd@test.com',
      firstName: 'D',
      lastName: 'R',
      numberId: '3',
      numberIdType: 'V',
      type: 'deliveryDriver',
    });
    expect(result.error).toBeUndefined();
  });

  it('accepts create with storeId for superAdmin payloads', () => {
    const result = createSchema.validate({
      email: 'a@test.com',
      firstName: 'A',
      lastName: 'B',
      numberId: '1',
      numberIdType: 'V',
      storeId: STORE_ID,
      type: 'deliveryDriver',
    });
    expect(result.error).toBeUndefined();
    expect(result.value.storeId).toBe(STORE_ID);
  });

  it('does not require storeId for client create', () => {
    const result = createSchema.validate({
      email: 'c@test.com',
      firstName: 'C',
      lastName: 'D',
      numberId: '2',
      numberIdType: 'V',
      type: 'client',
    });
    expect(result.error).toBeUndefined();
  });

  it('allows optional storeId on patch', () => {
    const result = patchSchema.validate({ storeId: STORE_ID });
    expect(result.error).toBeUndefined();
  });

  it('forbids password on create', () => {
    const result = createSchema.validate({
      email: 'c@test.com',
      firstName: 'C',
      lastName: 'D',
      numberId: '2',
      numberIdType: 'V',
      password: 'TempPass1',
      type: 'client',
    });
    expect(result.error).toBeDefined();
  });

  it('forbids password on patch', () => {
    const result = patchSchema.validate({ password: 'TempPass1' });
    expect(result.error).toBeDefined();
  });
});
