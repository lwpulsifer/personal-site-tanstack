import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { LionLocation } from '#/lib/lion-types'
import { LionMarkerPopup } from './LionMarkerPopup'

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

const lionIcon = new L.DivIcon({
  html: '<span style="font-size:28px;line-height:1">🦁</span>',
  className: 'lion-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function LionMap({
  locations,
  onSelectLocation,
  onMapClick,
  selectedLocationId,
}: {
  locations: LionLocation[]
  onSelectLocation?: (location: LionLocation) => void
  onMapClick?: (lat: number, lng: number) => void
  selectedLocationId?: string | null
}) {
  return (
    <MapContainer
      center={SF_CENTER}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onMapClick && <ClickHandler onClick={onMapClick} />}
      {locations.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={lionIcon}
          eventHandlers={{
            click: () => onSelectLocation?.(loc),
          }}
        >
          <Popup>
            <LionMarkerPopup
              location={loc}
              isSelected={selectedLocationId === loc.id}
              onViewDetails={() => onSelectLocation?.(loc)}
            />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
