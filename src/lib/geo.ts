export type LatLng = { lat: number; lng: number }

// Rough bounding box for the SF Bay Area. We use a conservative rectangle so:
// - users can't accidentally submit far outside the region
// - we don't need any expensive geofencing logic
// This can be refined later if needed.
// San Francisco city proper (rough bounding box).
// Note: This is intentionally approximate and slightly conservative to keep
// submissions within SF without needing complex polygon checks.
export const BAY_AREA_BOUNDS = {
  minLat: 37.70,
  maxLat: 37.84,
  minLng: -122.52,
  maxLng: -122.35,
} as const

export function isWithinBayArea(lat: number, lng: number) {
  return (
    lat >= BAY_AREA_BOUNDS.minLat &&
    lat <= BAY_AREA_BOUNDS.maxLat &&
    lng >= BAY_AREA_BOUNDS.minLng &&
    lng <= BAY_AREA_BOUNDS.maxLng
  )
}

export function haversineDistanceMeters(a: LatLng, b: LatLng) {
  const R = 6371e3
  const phi1 = (a.lat * Math.PI) / 180
  const phi2 = (b.lat * Math.PI) / 180
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180

  const x =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

export function findNearestWithinRadius<T extends { lat: number; lng: number }>(
  items: T[],
  coords: LatLng | null | undefined,
  radiusMeters: number,
) {
  if (!coords) return null
  let best: { item: T; distanceMeters: number } | null = null
  for (const it of items) {
    const d = haversineDistanceMeters(coords, { lat: it.lat, lng: it.lng })
    if (d <= radiusMeters && (!best || d < best.distanceMeters)) {
      best = { item: it, distanceMeters: d }
    }
  }
  return best
}
