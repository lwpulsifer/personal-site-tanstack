import { Suspense, lazy } from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import type { MapLocation } from '#/lib/map-types'
import { MapSkeleton } from './MapSkeleton'

const importMapViewClient = createClientOnlyFn(() => import('./MapView.client'))
const MapViewClient = lazy(async () => {
  const m = await importMapViewClient()
  return { default: m.MapView }
})

export function MapView({
  locations,
  onSelectLocation,
  onMapClick,
  onMapClickOutOfBounds,
  selectedLocationId,
  previewCoords,
}: {
  locations: MapLocation[]
  onSelectLocation?: (location: MapLocation) => void
  onMapClick?: (lat: number, lng: number) => void
  onMapClickOutOfBounds?: (lat: number, lng: number) => void
  selectedLocationId?: string | null
  previewCoords?: { lat: number; lng: number } | null
}) {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <MapViewClient
        locations={locations}
        onSelectLocation={onSelectLocation}
        onMapClick={onMapClick}
        onMapClickOutOfBounds={onMapClickOutOfBounds}
        selectedLocationId={selectedLocationId}
        previewCoords={previewCoords}
      />
    </Suspense>
  )
}
