import { describe, expect, it } from 'vitest';

import {
  isInsideDeliveryCityBounds,
  normalizeDeliveryCity,
  resolveDeliveryCityFromPlaceTexts,
} from '../delivery.js';

describe('delivery city helpers', () => {
  it('normalizes merida place labels only', () => {
    expect(normalizeDeliveryCity('Mérida')).toBe('merida');
    expect(normalizeDeliveryCity('Libertador')).toBe('merida');
    expect(normalizeDeliveryCity('Municipio Libertador')).toBe('merida');
  });

  it('does not treat state-only or other municipalities as merida city', () => {
    expect(normalizeDeliveryCity('Sucre, Mérida, Venezuela')).toBeNull();
    expect(normalizeDeliveryCity('Sucre')).toBeNull();
    expect(normalizeDeliveryCity('Lagunillas')).toBeNull();
    expect(normalizeDeliveryCity('Municipio Libertador, Merida')).toBeNull();
  });

  it('normalizes tovar place labels', () => {
    expect(normalizeDeliveryCity('Tovar')).toBe('tovar');
    expect(normalizeDeliveryCity('tovar centro')).toBe('tovar');
  });

  it('resolves city from place-level texts ignoring region', () => {
    expect(resolveDeliveryCityFromPlaceTexts(['Sucre'])).toBeNull();
    expect(resolveDeliveryCityFromPlaceTexts(['Mérida'])).toBe('merida');
    expect(resolveDeliveryCityFromPlaceTexts(['Tovar', 'Mérida'])).toBe('tovar');
    expect(resolveDeliveryCityFromPlaceTexts(['Libertador'])).toBe('merida');
  });

  it('rejects pins outside merida urban bounds (e.g. Lagunillas/Sucre)', () => {
    expect(isInsideDeliveryCityBounds('merida', 8.51, -71.39)).toBe(false);
    expect(isInsideDeliveryCityBounds('merida', 8.52, -71.27)).toBe(false);
  });

  it('accepts pins near Las Americas and Altochama', () => {
    expect(isInsideDeliveryCityBounds('merida', 8.598136, -71.150426)).toBe(true);
    expect(isInsideDeliveryCityBounds('merida', 8.556639, -71.198714)).toBe(true);
  });

  it('validates slugs', () => {
    expect(normalizeDeliveryCity('Caracas')).toBeNull();
  });
});
