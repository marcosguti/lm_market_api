export interface TrackingConfig {
  locationIntervalSeconds: number;
  maxAccuracyMeters: number;
  routeRefreshDistanceMeters: number;
  routeRefreshSeconds: number;
  staleAfterSeconds: number;
}

export function getTrackingConfig(): TrackingConfig {
  return {
    locationIntervalSeconds: readPositiveInt('TRACKING_LOCATION_INTERVAL_SECONDS', 5),
    maxAccuracyMeters: readPositiveInt('TRACKING_MAX_ACCURACY_METERS', 100),
    routeRefreshDistanceMeters: readPositiveInt('TRACKING_ROUTE_REFRESH_DISTANCE_METERS', 150),
    routeRefreshSeconds: readPositiveInt('TRACKING_ROUTE_REFRESH_SECONDS', 60),
    staleAfterSeconds: readPositiveInt('TRACKING_STALE_AFTER_SECONDS', 45),
  };
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.trunc(value);
}
