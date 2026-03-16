import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useMemo, useState, useCallback, useEffect } from 'react'
import { SITE_TITLE, SITE_URL } from '#/lib/site'
import { getApprovedLocations } from '#/server/maps'
import { mapLocationsQueryOptions } from '#/lib/queries'
import { useAuth } from '#/lib/auth'
import { LocationDetail } from '#/components/maps/LocationDetail'
import { SubmissionForm } from '#/components/maps/SubmissionForm'
import { AdminPanel } from '#/components/maps/AdminPanel'
import type { MapLocation, MapSubmission } from '#/lib/map-types'
import { MapSkeleton } from '#/components/maps/MapSkeleton'
import { findNearestWithinRadius } from '#/lib/geo'

const NEARBY_LOCATION_SUGGEST_RADIUS_METERS = 25

const MapView = lazy(() =>
  import('#/components/maps/MapView').then((m) => ({ default: m.MapView })),
)

const canonical = `${SITE_URL}/lions`
const pageTitle = `Lions of SF | ${SITE_TITLE}`

function toTestIdPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const Route = createFileRoute('/lions/')({
  loader: async () => getApprovedLocations({ data: { mapSlug: 'lions' } }),
  head: () => ({
    links: [
      { rel: 'canonical', href: canonical },
      { rel: 'stylesheet', href: '/leaflet.css' },
    ],
    meta: [
      { title: pageTitle },
      { name: 'description', content: 'An interactive map of lion statues across San Francisco.' },
    ],
  }),
  component: LionsPage,
})

function LionsPage() {
  const initialLocations = Route.useLoaderData()
  const { isAuthenticated } = useAuth()
  const { data: locations = initialLocations } = useQuery({
    ...mapLocationsQueryOptions('lions'),
    initialData: initialLocations,
  })

  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [submitLocation, setSubmitLocation] = useState<MapLocation | null>(null)
  const [submitMode, setSubmitMode] = useState<'new' | 'add-photos'>('new')

  const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedSubmission, setSelectedSubmission] = useState<MapSubmission | null>(null)
  const [mapBoundsError, setMapBoundsError] = useState<string | null>(null)
  const [dismissedNearbyLocationId, setDismissedNearbyLocationId] = useState<string | null>(null)

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setMapBoundsError(null)
    setClickedCoords({ lat, lng })
    setPreviewCoords({ lat, lng })
    setShowSubmitForm(true)
    setSelectedLocation(null)
    setSelectedSubmission(null)
  }, [])

  const handleSelectLocation = useCallback((location: MapLocation) => {
    setMapBoundsError(null)
    setSelectedLocation(location)
    setShowSubmitForm(false)
    setSelectedSubmission(null)
    setSubmitLocation(null)
  }, [])

  const handleSelectSubmission = useCallback((submission: MapSubmission) => {
    setMapBoundsError(null)
    setSelectedSubmission(submission)
    setSelectedLocation(null)
    setShowSubmitForm(false)
    setSubmitLocation(null)
    if (submission.proposed_lat && submission.proposed_lng) {
      setPreviewCoords({ lat: submission.proposed_lat, lng: submission.proposed_lng })
    }
  }, [])

  const handleAddPhotos = useCallback((location: MapLocation) => {
    setMapBoundsError(null)
    setSubmitMode('add-photos')
    setSubmitLocation(location)
    setShowSubmitForm(true)
    setSelectedLocation(null)
    setSelectedSubmission(null)
    setClickedCoords(null)
    setPreviewCoords({ lat: location.lat, lng: location.lng })
  }, [])

  const nearbySuggestion = useMemo(() => {
    if (!showSubmitForm || submitMode !== 'new') return null
    if (!previewCoords) return null
    return findNearestWithinRadius(locations, previewCoords, NEARBY_LOCATION_SUGGEST_RADIUS_METERS)
  }, [locations, previewCoords, showSubmitForm, submitMode])

  useEffect(() => {
    // If the suggested location changes, allow the prompt to show again.
    if (nearbySuggestion?.item.id && dismissedNearbyLocationId && nearbySuggestion.item.id !== dismissedNearbyLocationId) {
      setDismissedNearbyLocationId(null)
    }
  }, [dismissedNearbyLocationId, nearbySuggestion?.item.id])

  return (
    <main className="px-4 pb-8 pt-14">
      <section className="mx-auto mb-6 flex w-full max-w-[1080px] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="island-kicker mb-2">Explore</p>
          <h1
            data-testid="lions-heading"
            className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl"
          >
            Lions of SF
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            An interactive map of lion statues across San Francisco. Click the map to report a sighting!
          </p>
        </div>
        <button
          type="button"
          data-testid="report-sighting-btn"
          onClick={() => {
            setSubmitMode('new')
            setSubmitLocation(null)
            setShowSubmitForm(true)
            setSelectedLocation(null)
            setSelectedSubmission(null)
            setClickedCoords(null)
            setPreviewCoords(null)
            setDismissedNearbyLocationId(null)
          }}
          className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
        >
          + Report Sighting
        </button>
      </section>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 lg:flex-row">
        {/* Map */}
        <div className="island-shell relative h-[55dvh] min-h-[420px] flex-1 overflow-hidden rounded-2xl lg:h-[calc(100dvh-14rem)] lg:min-h-[720px]">
          {mapBoundsError && (
            <div
              data-testid="map-bounds-error"
              className="pointer-events-none absolute left-3 right-3 top-3 z-10 rounded-xl border border-red-500/20 bg-white/80 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm backdrop-blur-sm"
            >
              {mapBoundsError}
            </div>
          )}
          <Suspense
            fallback={
              <MapSkeleton />
            }
          >
            <MapView
              locations={locations}
              onSelectLocation={handleSelectLocation}
              onMapClick={handleMapClick}
              onMapClickOutOfBounds={() => setMapBoundsError('Please add sightings within the San Francisco Bay Area.')}
              selectedLocationId={selectedLocation?.id}
              previewCoords={showSubmitForm || selectedSubmission ? previewCoords : null}
            />
          </Suspense>
        </div>

        {/* Sidebar */}
        <div className="w-full shrink-0 lg:w-80">
          {showSubmitForm ? (
            <div className="space-y-3">
              {submitMode === 'new' && nearbySuggestion?.item && nearbySuggestion.item.id !== dismissedNearbyLocationId && (
                <div
                  data-testid="nearby-location-prompt"
                  className="island-shell rounded-2xl border border-[color-mix(in_oklab,var(--border),var(--blue)_25%)] bg-[color-mix(in_oklab,var(--surface),var(--blue)_3%)] p-4"
                >
                  <p className="m-0 text-sm font-semibold text-[var(--text)]">
                    There is already a lion location nearby.
                  </p>
                  <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                    <span data-testid="nearby-location-name" className="font-semibold text-[var(--text)]">
                      {nearbySuggestion.item.name}
                    </span>{' '}
                    is about {Math.round(nearbySuggestion.distanceMeters)}m away. Want to add photos to it instead?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      data-testid="nearby-location-use-existing"
                      onClick={() => {
                        setDismissedNearbyLocationId(null)
                        handleAddPhotos(nearbySuggestion.item)
                      }}
                      className="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)]"
                    >
                      Add photos to existing
                    </button>
                    <button
                      type="button"
                      data-testid="nearby-location-dismiss"
                      onClick={() => setDismissedNearbyLocationId(nearbySuggestion.item.id)}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--blue)]"
                    >
                      Continue new sighting
                    </button>
                  </div>
                </div>
              )}

              <SubmissionForm
                mapSlug="lions"
                mode={submitMode}
                locationId={submitMode === 'add-photos' ? submitLocation?.id : undefined}
                initialName={submitMode === 'add-photos' ? submitLocation?.name : undefined}
                initialAddress={submitMode === 'add-photos' ? submitLocation?.address ?? undefined : undefined}
                onClose={() => {
                  setShowSubmitForm(false)
                  setSubmitLocation(null)
                  setSubmitMode('new')
                  setPreviewCoords(null)
                  setDismissedNearbyLocationId(null)
                }}
                initialLat={clickedCoords?.lat}
                initialLng={clickedCoords?.lng}
                onCoordsChange={(lat, lng) => setPreviewCoords({ lat, lng })}
              />
            </div>
          ) : selectedLocation ? (
            <LocationDetail
              location={selectedLocation}
              onClose={() => setSelectedLocation(null)}
              onAddPhotos={handleAddPhotos}
            />
          ) : (
            <div className="island-shell rounded-2xl p-5">
              <h3 className="m-0 text-sm font-semibold text-[var(--text)]">
                {locations.length} lion{locations.length !== 1 ? 's' : ''} found
              </h3>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Click a marker to see details, or click the map to report a new sighting.
              </p>

              {locations.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {locations.map((loc) => (
                    <li key={loc.id}>
                      <button
                        type="button"
                        data-testid={`location-btn-${toTestIdPart(loc.name)}`}
                        onClick={() => handleSelectLocation(loc)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--blue)]"
                      >
                        <p data-testid={`location-name-${toTestIdPart(loc.name)}`} className="m-0 text-sm font-semibold text-[var(--text)]">{loc.name}</p>
                        {loc.address && (
                          <p className="m-0 text-xs text-[var(--text-muted)]">{loc.address}</p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isAuthenticated && (
            <div data-testid="lions-admin-panel" className="mt-4">
              <AdminPanel
                mapSlug="lions"
                onSelectSubmission={handleSelectSubmission}
                selectedSubmissionId={selectedSubmission?.id}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
