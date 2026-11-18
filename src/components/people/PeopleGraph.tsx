import { createSignal, lazy, Loading, onSettled, Show } from 'solid-js'
import type { DbConnection, DbPerson } from '../../server/people'
import type { GraphFocusRequest } from './graphFocus'
import { PeopleGraphSkeleton } from './PeopleGraphSkeleton'

// The force-graph canvas requires `window`, so the implementation is loaded
// lazily and only rendered after hydration; SSR and hydration show the skeleton.
const PeopleGraphClient = lazy(() => import('./PeopleGraph.client'))

export function PeopleGraph(props: {
  people: DbPerson[]
  connections: DbConnection[]
  onSelectPerson?: (person: DbPerson) => void
  focusRequest?: GraphFocusRequest | null
}) {
  const [hydrated, setHydrated] = createSignal(false)
  onSettled(() => {
    setHydrated(true)
  })

  return (
    <Show when={hydrated()} fallback={<PeopleGraphSkeleton />}>
      <Loading fallback={<PeopleGraphSkeleton />}>
        <PeopleGraphClient
          people={props.people}
          connections={props.connections}
          onSelectPerson={props.onSelectPerson}
          focusRequest={props.focusRequest}
        />
      </Loading>
    </Show>
  )
}
