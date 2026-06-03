const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Allows lm_market_web (Vite) and Flutter web dev server on any local port.
 */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const configured = process.env.CORS_ORIGIN?.trim();
  if (configured && origin === configured) return true;
  if (process.env.NODE_ENV !== 'production' && LOCAL_DEV_ORIGIN.test(origin)) {
    return true;
  }
  return false;
}

export const corsOriginCallback: (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void = (origin, callback) => {
  if (isCorsOriginAllowed(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Not allowed by CORS'));
};
