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
