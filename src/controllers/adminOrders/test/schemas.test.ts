import { describe, expect, it } from 'vitest';

import { kitchenListQuerySchema, patchStatusSchema } from '../schemas.js';

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
      'paymentPendingConfirmation',
      'paymentConfirmed',
      'preparing',
      'readyForDelivery',
      'assignedToDeliveryDriver',
      'delivering',
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

describe('patchStatusSchema', () => {
  it('requires cancellationReason when status is cancelled', () => {
    const missing = patchStatusSchema.validate({ status: 'cancelled' });
    expect(missing.error).toBeDefined();

    const short = patchStatusSchema.validate({
      cancellationReason: 'no',
      status: 'cancelled',
    });
    expect(short.error).toBeDefined();

    const ok = patchStatusSchema.validate({
      cancellationReason: '  Sin stock suficiente  ',
      status: 'cancelled',
    });
    expect(ok.error).toBeUndefined();
    expect(ok.value.cancellationReason).toBe('Sin stock suficiente');
  });

  it('forbids cancellationReason for non-cancel statuses', () => {
    const { error } = patchStatusSchema.validate({
      cancellationReason: 'no aplica',
      status: 'preparing',
    });
    expect(error).toBeDefined();

    const ok = patchStatusSchema.validate({ status: 'preparing' });
    expect(ok.error).toBeUndefined();
  });
});
