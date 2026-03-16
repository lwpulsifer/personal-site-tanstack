export type LatLng = { lat: number; lng: number }

// Rough bounding box for the SF Bay Area. We use a conservative rectangle so:
// - users can't accidentally submit far outside the region
// - we don't need any expensive geofencing logic
// This can be refined later if needed.
export const BAY_AREA_BOUNDS = {
  minLat: 36.8,
  maxLat: 38.9,
  minLng: -123.3,
  maxLng: -121.2,
} as const

export function isWithinBayArea(lat: number, lng: number) {
  return (
    lat >= BAY_AREA_BOUNDS.minLat &&
    lat <= BAY_AREA_BOUNDS.maxLat &&
    lng >= BAY_AREA_BOUNDS.minLng &&
    lng <= BAY_AREA_BOUNDS.maxLng
  )
}

