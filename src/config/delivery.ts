/** Max haversine distance (km) from store to delivery pin for moto delivery warning. */
export const MAX_DELIVERY_DISTANCE_KM = 15;

export const DELIVERY_CITY_SLUGS = ['merida', 'tovar'] as const;

export type DeliveryCityBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
};

export type DeliveryCitySlug = (typeof DELIVERY_CITY_SLUGS)[number];

/**
 * Approximate map bounds for checkout UX + server hard reject.
 * Mérida covers urban Libertador + Altochama/Las Americas corridor,
 * not Sucre/Lagunillas valley (state also named Mérida).
 */
export const DELIVERY_CITY_BOUNDS: Record<DeliveryCitySlug, DeliveryCityBounds> = {
  merida: {
    east: -71.1,
    north: 8.66,
    south: 8.53,
    west: -71.25,
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

export function clampToDeliveryCityBounds(
  city: DeliveryCitySlug,
  latitude: number,
  longitude: number,
): { latitude: number; longitude: number } {
  const b = DELIVERY_CITY_BOUNDS[city];
  return {
    latitude: Math.min(b.north, Math.max(b.south, latitude)),
    longitude: Math.min(b.east, Math.max(b.west, longitude)),
  };
}

export function isDeliveryCitySlug(value: string): value is DeliveryCitySlug {
  return (DELIVERY_CITY_SLUGS as readonly string[]).includes(value);
}

export function isInsideDeliveryCityBounds(
  city: DeliveryCitySlug,
  latitude: number,
  longitude: number,
): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const b = DELIVERY_CITY_BOUNDS[city];
  return latitude >= b.south && latitude <= b.north && longitude >= b.west && longitude <= b.east;
}

/**
 * Normalize a place/locality/district label (not a full address / region).
 * Does not match the state name "Mérida" inside longer strings like "Sucre, Mérida, Venezuela".
 */
export function normalizeDeliveryCity(raw: string): DeliveryCitySlug | null {
  const text = stripDiacritics(raw);
  if (!text) return null;
  if (text === 'tovar' || text.startsWith('tovar ')) return 'tovar';
  if (
    text === 'merida' ||
    text === 'libertador' ||
    text === 'municipio libertador' ||
    text.startsWith('libertador ')
  ) {
    return 'merida';
  }
  return null;
}

/** Resolve city from Mapbox place-level labels only (ignore region/state). */
export function resolveDeliveryCityFromPlaceTexts(
  texts: Array<null | string | undefined>,
): DeliveryCitySlug | null {
  const cleaned = texts
    .filter((t): t is string => Boolean(t && t.trim()))
    .map((t) => stripDiacritics(t));

  for (const text of cleaned) {
    if (text === 'tovar' || text.startsWith('tovar ')) return 'tovar';
  }
  for (const text of cleaned) {
    const city = normalizeDeliveryCity(text);
    if (city === 'merida') return 'merida';
  }
  return null;
}

function stripDiacritics(raw: string): string {
  return raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
