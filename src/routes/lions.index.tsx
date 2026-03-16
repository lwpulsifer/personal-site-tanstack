import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useState, useCallback } from 'react'
import { SITE_TITLE, SITE_URL } from '#/lib/site'
import { getApprovedLocations } from '#/server/lions'
import { lionLocationsQueryOptions } from '#/lib/queries'
import { useAuth } from '#/lib/auth'
import { LionLocationDetail } from '#/components/lions/LionLocationDetail'
import { LionSubmissionForm } from '#/components/lions/LionSubmissionForm'
import { LionAdminPanel } from '#/components/lions/LionAdminPanel'
import type { LionLocation } from '#/lib/lion-types'

import leafletCss from 'leaflet/dist/leaflet.css?url'

const LionMap = lazy(() =>
  import('#/components/lions/LionMap').then((m) => ({ default: m.LionMap })),
)

const canonical = `${SITE_URL}/lions`
const pageTitle = `Lions of SF | ${SITE_TITLE}`

export const Route = createFileRoute('/lions/')({
  loader: async () => getApprovedLocations(),
  head: () => ({
    links: [
      { rel: 'canonical', href: canonical },
      { rel: 'stylesheet', href: leafletCss },
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
    ...lionLocationsQueryOptions,
    initialData: initialLocations,
  })

  const [selectedLocation, setSelectedLocation] = useState<LionLocation | null>(null)
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null)

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setClickedCoords({ lat, lng })
    setShowSubmitForm(true)
    setSelectedLocation(null)
  }, [])

  const handleSelectLocation = useCallback((location: LionLocation) => {
    setSelectedLocation(location)
    setShowSubmitForm(false)
  }, [])

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="island-kicker mb-2">Explore</p>
          <h1 className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
            Lions of SF
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            An interactive map of lion statues across San Francisco. Click the map to report a sighting!
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowSubmitForm(true)
            setSelectedLocation(null)
            setClickedCoords(null)
          }}
          className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
        >
          + Report Sighting
        </button>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Map */}
        <div className="island-shell relative min-h-[400px] flex-1 overflow-hidden rounded-2xl lg:min-h-[600px]">
          <Suspense
            fallback={
              <div className="flex h-full min-h-[400px] items-center justify-center">
                <p className="text-[var(--text-muted)]">Loading map...</p>
              </div>
            }
          >
            <LionMap
              locations={locations}
              onSelectLocation={handleSelectLocation}
              onMapClick={handleMapClick}
              selectedLocationId={selectedLocation?.id}
            />
          </Suspense>
        </div>

        {/* Sidebar */}
        <div className="w-full shrink-0 lg:w-80">
          {showSubmitForm ? (
            <LionSubmissionForm
              onClose={() => setShowSubmitForm(false)}
              initialLat={clickedCoords?.lat}
              initialLng={clickedCoords?.lng}
            />
          ) : selectedLocation ? (
            <LionLocationDetail
              location={selectedLocation}
              onClose={() => setSelectedLocation(null)}
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
                        onClick={() => handleSelectLocation(loc)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--blue)]"
                      >
                        <p className="m-0 text-sm font-semibold text-[var(--text)]">{loc.name}</p>
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
            <div className="mt-4">
              <LionAdminPanel />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
