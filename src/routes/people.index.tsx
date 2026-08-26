import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { ConnectionPanel } from '#/components/people/ConnectionPanel'
import { GroupPanel } from '#/components/people/GroupPanel'
import type { GraphFocusRequest } from '#/components/people/graphFocus'
import { PeopleGraph } from '#/components/people/PeopleGraph'
import { PersonPanel } from '#/components/people/PersonPanel'
import { peopleGraphQueryOptions } from '#/lib/queries'
import { SITE_TITLE } from '#/lib/site'
import { getServerUser } from '#/server/auth'
import {
  type DbConnection,
  type DbPerson,
  getPeopleGraph,
} from '#/server/people'

const pageTitle = `People | ${SITE_TITLE}`

export const Route = createFileRoute('/people/')({
  // Admin-only, and deliberately doesn't reveal itself to anyone else — a
  // 404 rather than a login redirect for anyone unauthenticated.
  beforeLoad: async () => {
    const user = await getServerUser()
    if (!user) throw notFound()
  },
  loader: async () => getPeopleGraph(),
  head: () => ({
    meta: [{ title: pageTitle }, { name: 'robots', content: 'noindex' }],
  }),
  component: PeopleIndex,
})

function PeopleIndex() {
  const loaderData = Route.useLoaderData()
  const { data = loaderData, isFetching } = useQuery(peopleGraphQueryOptions)
  const queryClient = useQueryClient()
  const [selectedPerson, setSelectedPerson] = useState<DbPerson | null>(null)
  const [focusRequest, setFocusRequest] = useState<GraphFocusRequest | null>(
    null,
  )

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: peopleGraphQueryOptions.queryKey,
    })
  }

  function handlePersonChanged(createdPerson?: DbPerson) {
    invalidate()
    if (createdPerson) {
      setFocusRequest({
        kind: 'person',
        personId: createdPerson.id,
        requestId: Date.now(),
      })
    }
  }

  function handlePersonSelected(person: DbPerson) {
    setSelectedPerson(person)
    setFocusRequest({
      kind: 'person',
      personId: person.id,
      requestId: Date.now(),
    })
  }

  function handleConnectionChanged(createdConnection?: DbConnection) {
    invalidate()
    if (createdConnection) {
      setFocusRequest({
        kind: 'connection',
        personAId: createdConnection.person_a_id,
        personBId: createdConnection.person_b_id,
        requestId: Date.now(),
      })
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="mb-6">
        <p className="island-kicker mb-2">Admin</p>
        <h1
          data-testid="people-heading"
          className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl"
        >
          People
        </h1>
      </section>

      <div className="mb-6 h-[420px]">
        <PeopleGraph
          people={data.people}
          connections={data.connections}
          onSelectPerson={setSelectedPerson}
          focusRequest={focusRequest}
        />
      </div>

      {selectedPerson && (
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Selected:{' '}
          <span className="text-[var(--text)]">{selectedPerson.name}</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <PersonPanel
          onChanged={handlePersonChanged}
          onSelect={handlePersonSelected}
        />
        <ConnectionPanel
          people={data.people}
          connections={data.connections}
          isStale={isFetching}
          onChanged={handleConnectionChanged}
        />
      </div>

      <div className="mt-4">
        <GroupPanel people={data.people} onChanged={invalidate} />
      </div>
    </main>
  )
}
