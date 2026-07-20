import { describe, expect, it } from 'vitest';

import { confirmPaymentSchema, orderHistoryQuerySchema } from '../schemas.js';

describe('orderHistoryQuerySchema', () => {
  it('defaults page and pageSize', () => {
    const { error, value } = orderHistoryQuerySchema.validate({}, { convert: true });
    expect(error).toBeUndefined();
    expect(value.page).toBe(1);
    expect(value.pageSize).toBe(20);
  });

  it('accepts createdFrom, createdTo and q', () => {
    const { error, value } = orderHistoryQuerySchema.validate(
      {
        createdFrom: '2026-06-20',
        createdTo: '2026-07-20',
        q: 'leche',
      },
      { convert: true },
    );
    expect(error).toBeUndefined();
    expect(value.q).toBe('leche');
    expect(value.createdFrom).toBeInstanceOf(Date);
    expect(value.createdTo).toBeInstanceOf(Date);
  });

  it('rejects when createdTo is before createdFrom', () => {
    const { error } = orderHistoryQuerySchema.validate(
      {
        createdFrom: '2026-07-20',
        createdTo: '2026-06-01',
      },
      { convert: true },
    );
    expect(error).toBeDefined();
  });

  it('allows empty q', () => {
    const { error, value } = orderHistoryQuerySchema.validate({ q: '' }, { convert: true });
    expect(error).toBeUndefined();
    expect(value.q).toBe('');
  });
});

describe('confirmPaymentSchema', () => {
  it('accepts customerNotes up to 280 chars', () => {
    const { error, value } = confirmPaymentSchema.validate({
      customerNotes: 'Portón azul, edif. Torre Norte',
      method: 'cash',
    });
    expect(error).toBeUndefined();
    expect(value.customerNotes).toBe('Portón azul, edif. Torre Norte');
  });

  it('rejects customerNotes longer than 280 chars', () => {
    const { error } = confirmPaymentSchema.validate({
      customerNotes: 'x'.repeat(281),
      method: 'cash',
    });
    expect(error).toBeDefined();
  });
});
