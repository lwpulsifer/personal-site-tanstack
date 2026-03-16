import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-popup">{children}</div>
  ),
  useMapEvents: () => null,
  useMap: () => ({ flyTo: vi.fn(), getZoom: () => 13 }),
}))

vi.mock('leaflet', () => {
  const DivIcon = vi.fn()
  return {
    default: {
      DivIcon,
      Icon: { Default: { mergeOptions: vi.fn() } },
    },
    DivIcon,
    Icon: { Default: { mergeOptions: vi.fn() } },
  }
})

vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: '' }))
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: '' }))
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: '' }))

const { MapView } = await import('#/components/maps/MapView')

describe('MapView', () => {
  const locations = [
    {
      id: 'loc-1',
      map_slug: 'lions',
      name: 'Test Lion',
      description: null,
      address: '123 Main St',
      lat: 37.78,
      lng: -122.42,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      created_by: null,
      photo_count: 3,
    },
    {
      id: 'loc-2',
      map_slug: 'lions',
      name: 'Another Lion',
      description: 'Big one',
      address: null,
      lat: 37.79,
      lng: -122.41,
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
      created_by: null,
      photo_count: 0,
    },
  ]

  it('renders the map container', () => {
    render(<MapView locations={locations} />)
    expect(screen.getByTestId('map-container')).toBeTruthy()
  })

  it('renders a marker for each location', () => {
    render(<MapView locations={locations} />)
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2)
  })

  it('shows location names in popups', () => {
    render(<MapView locations={locations} />)
    expect(screen.getByText('Test Lion')).toBeTruthy()
    expect(screen.getByText('Another Lion')).toBeTruthy()
  })
})
