import { describe, expect, it } from 'vitest';

import { isDeliveryCitySlug, normalizeDeliveryCity } from '../delivery.js';

describe('delivery city helpers', () => {
  it('normalizes merida variants', () => {
    expect(normalizeDeliveryCity('Mérida')).toBe('merida');
    expect(normalizeDeliveryCity('Municipio Libertador, Merida')).toBe('merida');
  });

  it('normalizes tovar', () => {
    expect(normalizeDeliveryCity('Tovar, Mérida')).toBe('tovar');
  });

  it('rejects unknown places', () => {
    expect(normalizeDeliveryCity('Caracas')).toBeNull();
  });

  it('validates slugs', () => {
    expect(isDeliveryCitySlug('merida')).toBe(true);
    expect(isDeliveryCitySlug('caracas')).toBe(false);
  });
});
