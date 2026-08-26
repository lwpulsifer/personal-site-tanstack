import { createClientOnlyFn } from '@tanstack/react-start'
import { lazy, memo, Suspense } from 'react'
import { useHydrated } from '#/lib/hooks/useHydrated'
import type { DbConnection, DbPerson } from '#/server/people'
import type { GraphFocusRequest } from './graphFocus'
import { PeopleGraphSkeleton } from './PeopleGraphSkeleton'

const importPeopleGraphClient = createClientOnlyFn(
  () => import('./PeopleGraph.client'),
)
const PeopleGraphClient = lazy(async () => {
  const m = await importPeopleGraphClient()
  return { default: m.PeopleGraph }
})

export const PeopleGraph = memo(function PeopleGraph({
  people,
  connections,
  onSelectPerson,
  focusRequest,
}: {
  people: DbPerson[]
  connections: DbConnection[]
  onSelectPerson?: (person: DbPerson) => void
  focusRequest?: GraphFocusRequest | null
}) {
  const hydrated = useHydrated()

  // The force-graph canvas requires `window`, so render the skeleton during
  // SSR and hydration — same guard as MapView for Leaflet.
  if (!hydrated) return <PeopleGraphSkeleton />

  return (
    <Suspense fallback={<PeopleGraphSkeleton />}>
      <PeopleGraphClient
        people={people}
        connections={connections}
        onSelectPerson={onSelectPerson}
        focusRequest={focusRequest}
      />
    </Suspense>
  )
})
