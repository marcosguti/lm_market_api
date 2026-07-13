import type { OrderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  canTransitionByAdmin,
  computeTotal,
  mergeInputsByCode,
  OrderDomainError,
  type OrderLine,
} from '../orderService.js';

describe('OrderDomainError', () => {
  it('carries code, message, statusCode and details', () => {
    const err = new OrderDomainError('ORDER_NOT_FOUND', 'Pedido no encontrado', 404, { id: 'x' });
    expect(err.code).toBe('ORDER_NOT_FOUND');
    expect(err.message).toBe('Pedido no encontrado');
    expect(err.statusCode).toBe(404);
    expect(err.details).toEqual({ id: 'x' });
    expect(err).toBeInstanceOf(Error);
  });
});

describe('mergeInputsByCode', () => {
  it('merges duplicate codes and sums quantities', () => {
    expect(
      mergeInputsByCode([
        { code: 'A', quantity: 2 },
        { code: 'A', quantity: 3 },
        { code: 'B', quantity: 1 },
      ]),
    ).toEqual([
      { code: 'A', quantity: 5 },
      { code: 'B', quantity: 1 },
    ]);
  });

  it('trims codes and drops zero or negative quantities', () => {
    expect(
      mergeInputsByCode([
        { code: '  X  ', quantity: 0 },
        { code: 'Y', quantity: -1 },
        { code: '', quantity: 5 },
      ]),
    ).toEqual([]);
  });
});

describe('computeTotal', () => {
  it('sums line totals with two decimal precision', () => {
    const lines: OrderLine[] = [
      { code: '1', description: null, lineTotal: 10.5, name: 'A', quantity: 1, unitPrice: 10.5 },
      { code: '2', description: null, lineTotal: 4.45, name: 'B', quantity: 1, unitPrice: 4.45 },
    ];
    expect(computeTotal(lines)).toBe(14.95);
  });
});

describe('canTransitionByAdmin', () => {
  const allowed: Array<[OrderStatus, OrderStatus]> = [
    ['pending', 'paymentConfirmed'],
    ['paymentConfirmed', 'preparing'],
    ['preparing', 'readyForDelivery'],
    ['outForDelivery', 'delivered'],
    ['pending', 'cancelled'],
    ['paymentConfirmed', 'cancelled'],
    ['preparing', 'cancelled'],
  ];

  it.each(allowed)('allows %s → %s', (from, to) => {
    expect(canTransitionByAdmin(from, to)).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransitionByAdmin('pending', 'delivered')).toBe(false);
    expect(canTransitionByAdmin('delivered', 'cancelled')).toBe(false);
    expect(canTransitionByAdmin('readyForDelivery', 'delivered')).toBe(false);
  });
});
