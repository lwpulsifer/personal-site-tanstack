import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useReducer } from 'react'
import { SITE_TITLE, SITE_URL } from '#/lib/site'
import { getApprovedLocations } from '#/server/maps'
import { mapLocationsQueryOptions } from '#/lib/queries'
import { useAuth } from '#/lib/auth'
import { LocationDetail } from '#/components/maps/LocationDetail'
import { SubmissionForm } from '#/components/maps/SubmissionForm'
import { AdminPanel } from '#/components/maps/AdminPanel'
import type { MapLocation, MapSubmission } from '#/lib/map-types'
import { MapSkeleton } from '#/components/maps/MapSkeleton'
import { StorageImage } from '#/components/maps/StorageImage'
import { toTestIdPart } from '#/lib/strings'
import { ErrorBoundary } from '#/components/ErrorBoundary'

const MapView = lazy(() =>
  import('#/components/maps/MapView').then((m) => ({ default: m.MapView })),
)

const canonical = `${SITE_URL}/lions`
const pageTitle = `Lions of SF | ${SITE_TITLE}`

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

// ── Sidebar state machine ─────────────────────────────────────────────────────

type SidebarState = {
  view: 'list' | 'location' | 'submit' | 'submission'
  selectedLocation: MapLocation | null
  selectedSubmission: MapSubmission | null
  submitMode: 'new' | 'add-photos'
  submitLocation: MapLocation | null
  clickedCoords: { lat: number; lng: number } | null
  previewCoords: { lat: number; lng: number } | null
  mapBoundsError: string | null
}

type SidebarAction =
  | { type: 'MAP_CLICK'; lat: number; lng: number }
  | { type: 'SELECT_LOCATION'; location: MapLocation }
  | { type: 'SELECT_SUBMISSION'; submission: MapSubmission }
  | { type: 'ADD_PHOTOS'; location: MapLocation }
  | { type: 'REPORT_SIGHTING' }
  | { type: 'CLOSE_FORM' }
  | { type: 'CLOSE_LOCATION' }
  | { type: 'SET_PREVIEW_COORDS'; lat: number; lng: number }
  | { type: 'MAP_CLICK_OUT_OF_BOUNDS' }

const initialSidebarState: SidebarState = {
  view: 'list',
  selectedLocation: null,
  selectedSubmission: null,
  submitMode: 'new',
  submitLocation: null,
  clickedCoords: null,
  previewCoords: null,
  mapBoundsError: null,
}

function sidebarReducer(state: SidebarState, action: SidebarAction): SidebarState {
  switch (action.type) {
    case 'MAP_CLICK':
      return {
        ...initialSidebarState,
        view: 'submit',
        clickedCoords: { lat: action.lat, lng: action.lng },
        previewCoords: { lat: action.lat, lng: action.lng },
      }
    case 'SELECT_LOCATION':
      return { ...initialSidebarState, view: 'location', selectedLocation: action.location }
    case 'SELECT_SUBMISSION':
      return {
        ...initialSidebarState,
        view: 'submission',
        selectedSubmission: action.submission,
        previewCoords:
          action.submission.proposed_lat && action.submission.proposed_lng
            ? { lat: action.submission.proposed_lat, lng: action.submission.proposed_lng }
            : null,
      }
    case 'ADD_PHOTOS':
      return {
        ...initialSidebarState,
        view: 'submit',
        submitMode: 'add-photos',
        submitLocation: action.location,
        previewCoords: { lat: action.location.lat, lng: action.location.lng },
      }
    case 'REPORT_SIGHTING':
      return { ...initialSidebarState, view: 'submit' }
    case 'CLOSE_FORM':
      return { ...initialSidebarState }
    case 'CLOSE_LOCATION':
      return { ...initialSidebarState }
    case 'SET_PREVIEW_COORDS':
      return { ...state, previewCoords: { lat: action.lat, lng: action.lng } }
    case 'MAP_CLICK_OUT_OF_BOUNDS':
      return { ...state, mapBoundsError: 'Please add sightings within the San Francisco Bay Area.' }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

function LionsPage() {
  const initialLocations = Route.useLoaderData()
  const { isAuthenticated } = useAuth()
  const { data: locations = initialLocations } = useQuery({
    ...mapLocationsQueryOptions('lions'),
    initialData: initialLocations,
  })

  const [state, dispatch] = useReducer(sidebarReducer, initialSidebarState)

  const handleMapClick = useCallback((lat: number, lng: number) => {
    dispatch({ type: 'MAP_CLICK', lat, lng })
  }, [])

  const handleSelectLocation = useCallback((location: MapLocation) => {
    dispatch({ type: 'SELECT_LOCATION', location })
  }, [])

  const handleSelectSubmission = useCallback((submission: MapSubmission) => {
    dispatch({ type: 'SELECT_SUBMISSION', submission })
  }, [])

  const handleAddPhotos = useCallback((location: MapLocation) => {
    dispatch({ type: 'ADD_PHOTOS', location })
  }, [])

  const showPreviewCoords = state.view === 'submit' || state.view === 'submission'

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
          onClick={() => dispatch({ type: 'REPORT_SIGHTING' })}
          className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
        >
          + Report Sighting
        </button>
      </section>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 lg:flex-row">
        {/* Map */}
        <div className="island-shell relative h-[55dvh] min-h-[420px] flex-1 overflow-hidden rounded-2xl lg:h-[calc(100dvh-14rem)] lg:min-h-[720px]">
          {state.mapBoundsError && (
            <div
              data-testid="map-bounds-error"
              className="pointer-events-none absolute left-3 right-3 top-3 z-10 rounded-xl border border-red-500/20 bg-white/80 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm backdrop-blur-sm"
            >
              {state.mapBoundsError}
            </div>
          )}
          <ErrorBoundary
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                Failed to load the map. Please refresh the page.
              </div>
            }
          >
            <Suspense fallback={<MapSkeleton />}>
              <MapView
                locations={locations}
                onSelectLocation={handleSelectLocation}
                onMapClick={handleMapClick}
                onMapClickOutOfBounds={() => dispatch({ type: 'MAP_CLICK_OUT_OF_BOUNDS' })}
                selectedLocationId={state.selectedLocation?.id}
                previewCoords={showPreviewCoords ? state.previewCoords : null}
              />
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* Sidebar */}
        <div className="w-full shrink-0 lg:w-80">
          {state.view === 'submit' ? (
            <SubmissionForm
              mapSlug="lions"
              mode={state.submitMode}
              locationId={state.submitMode === 'add-photos' ? state.submitLocation?.id : undefined}
              initialName={state.submitMode === 'add-photos' ? state.submitLocation?.name : undefined}
              initialAddress={state.submitMode === 'add-photos' ? state.submitLocation?.address ?? undefined : undefined}
              onClose={() => dispatch({ type: 'CLOSE_FORM' })}
              initialLat={state.clickedCoords?.lat}
              initialLng={state.clickedCoords?.lng}
              onCoordsChange={(lat, lng) => dispatch({ type: 'SET_PREVIEW_COORDS', lat, lng })}
            />
          ) : state.view === 'location' && state.selectedLocation ? (
            <LocationDetail
              location={state.selectedLocation}
              onClose={() => dispatch({ type: 'CLOSE_LOCATION' })}
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
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-left transition hover:border-[var(--blue)]"
                      >
                        {loc.thumbnail_path ? (
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                            <StorageImage
                              bucket="map-photos"
                              storagePath={loc.thumbnail_path}
                              alt=""
                              className="h-full w-full object-cover"
                              width={48}
                              height={48}
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--surface),var(--text)_6%)]">
                            <span className="text-lg">🦁</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p data-testid={`location-name-${toTestIdPart(loc.name)}`} className="m-0 truncate text-sm font-semibold text-[var(--text)]">{loc.name}</p>
                          {loc.address && (
                            <p className="m-0 truncate text-xs text-[var(--text-muted)]">{loc.address}</p>
                          )}
                          <p className="m-0 mt-0.5 text-xs text-[var(--text-muted)]">
                            {loc.submitted_by && <>Spotted by {loc.submitted_by}</>}
                            {loc.submitted_by && loc.photo_count > 0 && ' · '}
                            {loc.photo_count > 0 && <>{loc.photo_count} photo{loc.photo_count !== 1 ? 's' : ''}</>}
                          </p>
                        </div>
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
                selectedSubmissionId={state.selectedSubmission?.id}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
