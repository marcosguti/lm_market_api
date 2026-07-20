/** Max haversine distance (km) from store to delivery pin for moto delivery warning. */
export const MAX_DELIVERY_DISTANCE_KM = 15;

export const DELIVERY_CITY_SLUGS = ['merida', 'tovar'] as const;

export type DeliveryCityBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
};

/** Closed GeoJSON ring: [lng, lat][]. First point equals last. */
export type DeliveryCityPolygon = Array<[number, number]>;

export type DeliveryCitySlug = (typeof DELIVERY_CITY_SLUGS)[number];

/**
 * Approximate valid delivery zones (urban corridor).
 * Edit vertices only; bounds are derived automatically.
 */
export const DELIVERY_CITY_POLYGONS: Record<DeliveryCitySlug, DeliveryCityPolygon> = {
  merida: [
    [-71.22, 8.64],
    [-71.14, 8.655],
    [-71.11, 8.62],
    [-71.12, 8.575],
    [-71.155, 8.548],
    [-71.205, 8.542],
    [-71.245, 8.555],
    [-71.25, 8.59],
    [-71.22, 8.64],
  ],
  tovar: [
    [-71.78, 8.345],
    [-71.74, 8.345],
    [-71.735, 8.325],
    [-71.745, 8.31],
    [-71.775, 8.315],
    [-71.78, 8.345],
  ],
};

export const DELIVERY_CITY_CENTER: Record<DeliveryCitySlug, { lat: number; lng: number }> = {
  merida: { lat: 8.5897, lng: -71.1561 },
  tovar: { lat: 8.3305, lng: -71.7575 },
};

function boundsFromPolygon(ring: DeliveryCityPolygon): DeliveryCityBounds {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { east, north, south, west };
}

export const DELIVERY_CITY_BOUNDS: Record<DeliveryCitySlug, DeliveryCityBounds> = {
  merida: boundsFromPolygon(DELIVERY_CITY_POLYGONS.merida),
  tovar: boundsFromPolygon(DELIVERY_CITY_POLYGONS.tovar),
};

/** @deprecated Prefer clampToDeliveryCityPolygon; bbox clamp kept for camera helpers. */
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

/**
 * If the point is inside the polygon, return it; otherwise fall back to city center
 * (clients should prefer keeping the last valid pin).
 */
export function clampToDeliveryCityPolygon(
  city: DeliveryCitySlug,
  latitude: number,
  longitude: number,
): { latitude: number; longitude: number } {
  if (isInsideDeliveryCityPolygon(city, latitude, longitude)) {
    return { latitude, longitude };
  }
  const center = DELIVERY_CITY_CENTER[city];
  return { latitude: center.lat, longitude: center.lng };
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

export function isInsideDeliveryCityPolygon(
  city: DeliveryCitySlug,
  latitude: number,
  longitude: number,
): boolean {
  return isPointInPolygon(latitude, longitude, DELIVERY_CITY_POLYGONS[city]);
}

/** Ray-casting point-in-polygon. Ring is [lng, lat][]. */
export function isPointInPolygon(
  latitude: number,
  longitude: number,
  ring: DeliveryCityPolygon,
): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || ring.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
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
