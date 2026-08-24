export interface GeoResult {
  lat: number;
  lng: number;
  accuracyM: number;
}

const TIMEOUT_MS = 6000;

/**
 * Best-effort device location for a clock in/out - resolves to `null`
 * (never rejects) if geolocation isn't supported, permission is denied, or
 * it takes too long. Capturing a location must never block the punch
 * itself, so callers should always be able to proceed on a null result.
 *
 * Races the browser's own `timeout` option with a manual timer, since some
 * browsers only start counting `timeout` once permission is granted rather
 * than from the initial prompt.
 */
export function getBestEffortLocation(): Promise<GeoResult | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (result: GeoResult | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    setTimeout(() => finish(null), TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        finish({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      () => finish(null),
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 60000 },
    );
  });
}

/** Link to view a captured coordinate on a map - no API key/geocoding needed. */
export function mapLinkUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
