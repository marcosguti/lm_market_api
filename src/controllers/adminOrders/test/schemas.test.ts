import { describe, expect, it } from 'vitest';

import { kitchenListQuerySchema } from '../schemas.js';

describe('kitchenListQuerySchema', () => {
  it('defaults status to all and pagination values', () => {
    const { error, value } = kitchenListQuerySchema.validate({}, { convert: true });
    expect(error).toBeUndefined();
    expect(value).toEqual({
      page: 1,
      pageSize: 20,
      status: 'all',
    });
  });

  it('accepts all order status values', () => {
    const statuses = [
      'pending',
      'paymentConfirmed',
      'preparing',
      'readyForDelivery',
      'outForDelivery',
      'delivered',
      'cancelled',
    ] as const;

    for (const status of statuses) {
      const { error } = kitchenListQuerySchema.validate({ status }, { convert: true });
      expect(error).toBeUndefined();
    }
  });

  it('rejects invalid date range', () => {
    const { error } = kitchenListQuerySchema.validate(
      {
        createdFrom: '2026-07-13',
        createdTo: '2026-07-01',
      },
      { convert: true },
    );
    expect(error).toBeDefined();
  });
});
