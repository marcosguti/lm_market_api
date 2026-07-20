import { describe, expect, it } from 'vitest';

import { resolveCityFromGeocodeFeature } from '../mapboxGeocoding.js';

describe('resolveCityFromGeocodeFeature', () => {
  it('accepts place Mérida and ignores region-only merida', () => {
    expect(
      resolveCityFromGeocodeFeature({
        context: [
          { id: 'region.1', text: 'Mérida' },
          { id: 'country.1', text: 'Venezuela' },
        ],
        id: 'place.sucre',
        place_name: 'Sucre, Mérida, Venezuela',
        text: 'Sucre',
      }),
    ).toBeNull();

    expect(
      resolveCityFromGeocodeFeature({
        context: [
          { id: 'region.1', text: 'Mérida' },
          { id: 'country.1', text: 'Venezuela' },
        ],
        id: 'place.merida',
        place_name: 'Mérida, Venezuela',
        text: 'Mérida',
      }),
    ).toBe('merida');
  });

  it('accepts locality Libertador under state Mérida', () => {
    expect(
      resolveCityFromGeocodeFeature({
        context: [
          { id: 'place.1', text: 'Libertador' },
          { id: 'region.1', text: 'Mérida' },
        ],
        id: 'address.1',
        place_name: 'Av. Las Américas, Libertador, Mérida, Venezuela',
        text: 'Av. Las Américas',
      }),
    ).toBe('merida');
  });

  it('prefers Tovar place over state Mérida', () => {
    expect(
      resolveCityFromGeocodeFeature({
        context: [
          { id: 'place.1', text: 'Tovar' },
          { id: 'region.1', text: 'Mérida' },
        ],
        id: 'address.1',
        place_name: 'Centro, Tovar, Mérida, Venezuela',
        text: 'Centro',
      }),
    ).toBe('tovar');
  });
});
