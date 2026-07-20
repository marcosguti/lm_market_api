import { describe, expect, it } from 'vitest';

import { assertAdminCanAccessOrder, OrderDomainError } from '../orderService.js';

describe('assertAdminCanAccessOrder', () => {
  it('allows superAdmin for any store', () => {
    expect(() =>
      assertAdminCanAccessOrder('superAdmin', null, { storeId: 'store-1' }),
    ).not.toThrow();
  });

  it('allows admin when store matches', () => {
    expect(() =>
      assertAdminCanAccessOrder('admin', 'store-1', { storeId: 'store-1' }),
    ).not.toThrow();
  });

  it('forbids admin when store differs', () => {
    expect(() => assertAdminCanAccessOrder('admin', 'store-2', { storeId: 'store-1' })).toThrow(
      OrderDomainError,
    );
    try {
      assertAdminCanAccessOrder('admin', 'store-2', { storeId: 'store-1' });
    } catch (err) {
      expect(err).toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    }
  });

  it('forbids admin when order has no storeId', () => {
    expect(() => assertAdminCanAccessOrder('admin', 'store-1', { storeId: null })).toThrow(
      OrderDomainError,
    );
  });

  it('forbids admin without storeId', () => {
    expect(() => assertAdminCanAccessOrder('admin', null, { storeId: 'store-1' })).toThrow(
      OrderDomainError,
    );
  });
});
