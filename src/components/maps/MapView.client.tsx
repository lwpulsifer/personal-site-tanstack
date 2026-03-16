import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { MapLocation } from '#/lib/map-types'
import { MarkerPopup } from './MarkerPopup'
import { BAY_AREA_BOUNDS, isWithinBayArea } from '#/lib/geo'

// Fix default Leaflet marker icons (they break with bundlers)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const SF_CENTER: [number, number] = [37.7749, -122.4194]

const mapMarkerIcon = new L.DivIcon({
  html: '<span style="font-size:28px;line-height:1">🦁</span>',
  className: 'map-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const previewMarkerIcon = new L.DivIcon({
  html: '<span data-testid="map-preview-marker" style="font-size:28px;line-height:1;opacity:0.7">📍</span>',
  className: 'map-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

function FlyToCoords({ coords }: { coords: { lat: number; lng: number } | null | undefined }) {
  const map = useMap()
  const prevCoords = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (coords && (coords.lat !== prevCoords.current?.lat || coords.lng !== prevCoords.current?.lng)) {
      map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), 16), { duration: 0.8 })
      prevCoords.current = coords
    }
  }, [coords, map])

  return null
}

function EnsureSfCentered() {
  const map = useMap()
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    // Leaflet can render slightly off-center when mounted into a flex layout
    // that is still settling. Force a known-good initial view and size.
    map.setView(SF_CENTER, 13, { animate: false })
    requestAnimationFrame(() => map.invalidateSize())
  }, [map])

  return null
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

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
  const selected = selectedLocationId
    ? locations.find((l) => l.id === selectedLocationId)
    : null
  const focusCoords = selected ? { lat: selected.lat, lng: selected.lng } : null
  const flyToCoords = previewCoords ?? focusCoords

  return (
    // react-leaflet doesn't guarantee forwarding unknown props to the underlying
    // container element, so we wrap in a div for stable e2e selectors.
    <div data-testid="map-container" className="h-full w-full">
      <MapContainer center={SF_CENTER} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <EnsureSfCentered />
        {/* Visual geofence: red mask outside the Bay Area bounds + red outline */}
        <Rectangle
          interactive={false}
          bounds={[[BAY_AREA_BOUNDS.maxLat, -180], [90, 180]]}
          pathOptions={{ stroke: false, fillColor: '#ef4444', fillOpacity: 0.16 }}
        />
        <Rectangle
          interactive={false}
          bounds={[[-90, -180], [BAY_AREA_BOUNDS.minLat, 180]]}
          pathOptions={{ stroke: false, fillColor: '#ef4444', fillOpacity: 0.16 }}
        />
        <Rectangle
          interactive={false}
          bounds={[[BAY_AREA_BOUNDS.minLat, -180], [BAY_AREA_BOUNDS.maxLat, BAY_AREA_BOUNDS.minLng]]}
          pathOptions={{ stroke: false, fillColor: '#ef4444', fillOpacity: 0.16 }}
        />
        <Rectangle
          interactive={false}
          bounds={[[BAY_AREA_BOUNDS.minLat, BAY_AREA_BOUNDS.maxLng], [BAY_AREA_BOUNDS.maxLat, 180]]}
          pathOptions={{ stroke: false, fillColor: '#ef4444', fillOpacity: 0.16 }}
        />
        <Rectangle
          interactive={false}
          bounds={[[BAY_AREA_BOUNDS.minLat, BAY_AREA_BOUNDS.minLng], [BAY_AREA_BOUNDS.maxLat, BAY_AREA_BOUNDS.maxLng]]}
          pathOptions={{ color: '#ef4444', weight: 2, fillOpacity: 0 }}
        />
        <FlyToCoords coords={flyToCoords} />
        {(onMapClick || onMapClickOutOfBounds) && (
          <ClickHandler
            onClick={(lat, lng) => {
              if (isWithinBayArea(lat, lng)) {
                onMapClick?.(lat, lng)
              } else {
                onMapClickOutOfBounds?.(lat, lng)
              }
            }}
          />
        )}
        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={mapMarkerIcon}
            eventHandlers={{
              click: () => onSelectLocation?.(loc),
            }}
          >
            <Popup>
              <MarkerPopup
                location={loc}
                isSelected={selectedLocationId === loc.id}
                onViewDetails={() => onSelectLocation?.(loc)}
              />
            </Popup>
          </Marker>
        ))}
        {previewCoords && (
          <Marker position={[previewCoords.lat, previewCoords.lng]} icon={previewMarkerIcon}>
            <Popup>New sighting location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
