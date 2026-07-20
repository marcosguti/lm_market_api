import { type DeliveryCitySlug, resolveDeliveryCityFromPlaceTexts } from '../config/delivery.js';

export interface ReverseGeocodeResult {
  address: string;
  city: DeliveryCitySlug;
}

interface MapboxGeocodeFeature {
  context?: Array<{ id?: string; text?: string }>;
  id?: string;
  place_name?: string;
  text?: string;
}

interface MapboxGeocodeResponse {
  features?: MapboxGeocodeFeature[];
  message?: string;
}

const PLACE_LEVEL_PREFIXES = ['place.', 'locality.', 'district.', 'neighborhood.'] as const;

export class MapboxGeocodingError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
    this.name = 'MapboxGeocodingError';
  }
}

/** Collect place/locality/district/neighborhood labels; ignore region/country. */
export function extractPlaceLevelTexts(feature: MapboxGeocodeFeature): string[] {
  const texts: string[] = [];
  if (isPlaceLevelId(feature.id) && feature.text?.trim()) {
    texts.push(feature.text.trim());
  }
  for (const entry of feature.context ?? []) {
    if (isPlaceLevelId(entry.id) && entry.text?.trim()) {
      texts.push(entry.text.trim());
    }
  }
  return texts;
}

export function resolveCityFromGeocodeFeature(
  feature: MapboxGeocodeFeature,
): DeliveryCitySlug | null {
  return resolveDeliveryCityFromPlaceTexts(extractPlaceLevelTexts(feature));
}

export async function reverseGeocodeDeliveryPin(params: {
  latitude: number;
  longitude: number;
  signal?: AbortSignal;
}): Promise<ReverseGeocodeResult> {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new MapboxGeocodingError('MAPBOX_ACCESS_TOKEN no configurado', 500);
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${params.longitude},${params.latitude}.json`,
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('language', 'es');
  url.searchParams.set('types', 'address,place,locality,neighborhood,district');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { signal: params.signal });
  if (!response.ok) {
    throw new MapboxGeocodingError(`Mapbox Geocoding HTTP ${response.status}`, 502);
  }

  const body = (await response.json()) as MapboxGeocodeResponse;
  const feature = body.features?.[0];
  if (!feature) {
    throw new MapboxGeocodingError('No se pudo resolver la dirección del pin', 422);
  }

  const city = resolveCityFromGeocodeFeature(feature);
  if (!city) {
    throw new MapboxGeocodingError('La ubicación debe estar dento de la ciudad de la tienda', 422);
  }

  const address = feature.place_name?.trim() || feature.text?.trim();
  if (!address) {
    throw new MapboxGeocodingError('Dirección de Mapbox vacía', 422);
  }

  return { address, city };
}

function isPlaceLevelId(id: string | undefined): boolean {
  if (!id) return false;
  return PLACE_LEVEL_PREFIXES.some((prefix) => id.startsWith(prefix));
}
