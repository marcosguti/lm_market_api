/** Max haversine distance (km) from store to delivery pin for moto delivery warning. */
export const MAX_DELIVERY_DISTANCE_KM = 15;

export const DELIVERY_CITY_SLUGS = ['merida', 'tovar'] as const;

export type DeliveryCitySlug = (typeof DELIVERY_CITY_SLUGS)[number];

/** Approximate map bounds [west, south, east, north] for checkout map UX. */
export const DELIVERY_CITY_BOUNDS: Record<
  DeliveryCitySlug,
  { east: number; north: number; south: number; west: number }
> = {
  merida: {
    east: -71.05,
    north: 8.68,
    south: 8.48,
    west: -71.28,
  },
  tovar: {
    east: -71.7,
    north: 8.38,
    south: 8.28,
    west: -71.82,
  },
};

export const DELIVERY_CITY_CENTER: Record<DeliveryCitySlug, { lat: number; lng: number }> = {
  merida: { lat: 8.5897, lng: -71.1561 },
  tovar: { lat: 8.3305, lng: -71.7575 },
};

export function isDeliveryCitySlug(value: string): value is DeliveryCitySlug {
  return (DELIVERY_CITY_SLUGS as readonly string[]).includes(value);
}

/** Normalize free-text place names from Mapbox into a supported city slug. */
export function normalizeDeliveryCity(raw: string): DeliveryCitySlug | null {
  const text = raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  if (!text) return null;
  if (text.includes('tovar')) return 'tovar';
  if (text.includes('merida')) return 'merida';
  return null;
}
