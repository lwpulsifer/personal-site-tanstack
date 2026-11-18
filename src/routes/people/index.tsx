import { Meta, Title } from '@solidjs/meta'
import type { RouteDefinition } from '@solidjs/router'
import { httpStatus } from '@solidjs/web'
import { createMemo, createSignal, isPending, Show } from 'solid-js'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { NotFound } from '../../components/NotFound'
import { ConnectionPanel } from '../../components/people/ConnectionPanel'
import { GroupPanel } from '../../components/people/GroupPanel'
import type { GraphFocusRequest } from '../../components/people/graphFocus'
import { PeopleGraph } from '../../components/people/PeopleGraph'
import { PersonPanel } from '../../components/people/PersonPanel'
import { SearchPanel } from '../../components/people/SearchPanel'
import { SuggestionsPanel } from '../../components/people/SuggestionsPanel'
import { useAuth } from '../../lib/auth'
import { SITE_TITLE } from '../../lib/site'
import { getServerUser } from '../../server/auth'
import { type DbConnection, type DbPerson, getPeopleGraph } from '../../server/people'

// Admin-only, and deliberately doesn't reveal itself to anyone else — a 404
// rather than a login redirect for anyone unauthenticated.
export const route = {
  preload: async () => {
    if (!(await getServerUser())) httpStatus(404)
  },
} satisfies RouteDefinition

function PeopleContent() {
  const data = createMemo(() => getPeopleGraph())
  const isFetching = () => isPending(() => data())
  const [selectedPerson, setSelectedPerson] = createSignal<DbPerson | null>(null)
  const [focusRequest, setFocusRequest] = createSignal<GraphFocusRequest | null>(null)

  // Panels' mutations name the query keys they touch, so `data` revalidates on
  // its own; these handlers only drive the graph's camera focus.
  const handlePersonChanged = (createdPerson?: DbPerson) => {
    if (createdPerson) {
      setFocusRequest({ kind: 'person', personId: createdPerson.id, requestId: Date.now() })
    }
  }

  const handlePersonSelected = (person: DbPerson) => {
    setSelectedPerson(person)
    setFocusRequest({ kind: 'person', personId: person.id, requestId: Date.now() })
  }

  const handleConnectionChanged = (createdConnection?: DbConnection) => {
    if (createdConnection) {
      setFocusRequest({
        kind: 'connection',
        personAId: createdConnection.person_a_id,
        personBId: createdConnection.person_b_id,
        requestId: Date.now(),
      })
    }
  }

  const noop = () => {}

  return (
    <main class="page-wrap px-4 pb-8 pt-14">
      <section class="mb-6">
        <p class="island-kicker mb-2">Admin</p>
        <h1
          data-testid="people-heading"
          class="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl"
        >
          People
        </h1>
      </section>

      <div class="mb-6 h-[420px]">
        <ErrorBoundary>
          <PeopleGraph
            people={data().people}
            connections={data().connections}
            onSelectPerson={setSelectedPerson}
            focusRequest={focusRequest()}
          />
        </ErrorBoundary>
      </div>

      <Show when={selectedPerson()}>
        {(person) => (
          <p class="mb-4 text-sm text-[var(--text-muted)]">
            Selected: <span class="text-[var(--text)]">{person().name}</span>
          </p>
        )}
      </Show>

      <div class="grid gap-4 sm:grid-cols-2">
        <PersonPanel onChanged={handlePersonChanged} onSelect={handlePersonSelected} />
        <ConnectionPanel
          people={data().people}
          connections={data().connections}
          isStale={isFetching()}
          onChanged={handleConnectionChanged}
        />
      </div>

      <div class="mt-4">
        <GroupPanel people={data().people} onChanged={noop} />
      </div>

      <div class="mt-4">
        <SearchPanel people={data().people} connections={data().connections} />
      </div>

      <div class="mt-4">
        <SuggestionsPanel people={data().people} connections={data().connections} onChanged={noop} />
      </div>
    </main>
  )
}

export default function PeopleIndex() {
  const { isAuthenticated } = useAuth()
  return (
    <>
      <Title>{`People | ${SITE_TITLE}`}</Title>
      <Meta name="robots" content="noindex" />
      <Show when={isAuthenticated()} fallback={<NotFound />}>
        <PeopleContent />
      </Show>
    </>
  )
}
