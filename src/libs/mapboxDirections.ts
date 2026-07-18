export interface MapboxRouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: {
    coordinates: [number, number][];
    type: 'LineString';
  };
}

interface DirectionsApiResponse {
  code?: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates: [number, number][];
      type: string;
    };
  }>;
}

export class MapboxDirectionsError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
    this.name = 'MapboxDirectionsError';
  }
}

export async function fetchDrivingRoute(params: {
  destinationLat: number;
  destinationLng: number;
  originLat: number;
  originLng: number;
  signal?: AbortSignal;
}): Promise<MapboxRouteResult> {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new MapboxDirectionsError('MAPBOX_ACCESS_TOKEN no configurado', 503);
  }

  const coordinates = `${params.originLng},${params.originLat};${params.destinationLng},${params.destinationLat}`;
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${encodeURIComponent(coordinates)}`,
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    method: 'GET',
    signal: params.signal,
  });

  if (!response.ok) {
    throw new MapboxDirectionsError(`Mapbox Directions HTTP ${response.status}`, 502);
  }

  const payload = (await response.json()) as DirectionsApiResponse;
  if (payload.code !== 'Ok' || !payload.routes?.[0]) {
    throw new MapboxDirectionsError(payload.message ?? 'No se pudo calcular la ruta', 502);
  }

  const route = payload.routes[0];
  if (!route.geometry || route.geometry.type !== 'LineString') {
    throw new MapboxDirectionsError('Geometría de ruta inválida', 502);
  }

  return {
    distanceMeters: route.distance,
    durationSeconds: Math.round(route.duration),
    geometry: {
      coordinates: route.geometry.coordinates,
      type: 'LineString',
    },
  };
}
