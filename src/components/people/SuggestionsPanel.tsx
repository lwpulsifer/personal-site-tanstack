import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useMemo, useState } from 'react'
import { type PeopleGraphData, peopleGraphQueryOptions } from '#/lib/queries'
import {
  type ConnectionKind,
  type DbConnection,
  type DbPerson,
  insertConnectionBatch,
} from '#/server/people'

type Suggestion = {
  personAId: string
  personBId: string
  kind: ConnectionKind
  // Ids of the shared parent(s) this suggestion is based on — two parents
  // means full siblings, one means half-siblings (or just an incompletely
  // entered family).
  viaParentIds: string[]
}

function pairKey(a: string, b: string) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join(':')
}

// Walks parent_child connections to find people who share a parent but have
// no sibling connection between them yet. Deliberately one-directional:
// person_a_id is the parent and person_b_id is the child (see
// connectionKind.ts) — only person_a_id is ever used as the grouping key
// below, so this only pairs up people who are both *children* of the same
// parent. It never symmetrizes the edge or groups by person_b_id, which
// would incorrectly treat "shares a child" (i.e. co-parents / partners) as
// "shares a parent".
function findSiblingSuggestions(connections: DbConnection[]): Suggestion[] {
  const childrenByParent = new Map<string, Set<string>>()
  for (const c of connections) {
    if (c.kind !== 'parent_child') continue
    // The no_self_loop DB constraint already rules this out, but there's no
    // uniqueness constraint on (person_a_id, person_b_id, kind) — the same
    // parent/child pair could be entered twice. A Set here (rather than an
    // array) absorbs that duplication, since two identical entries would
    // otherwise pair a child against themselves as their own "sibling".
    if (c.person_a_id === c.person_b_id) continue
    if (!childrenByParent.has(c.person_a_id)) {
      childrenByParent.set(c.person_a_id, new Set())
    }
    childrenByParent.get(c.person_a_id)?.add(c.person_b_id)
  }

  const existingSiblingPairs = new Set<string>()
  for (const c of connections) {
    if (c.kind === 'sibling') {
      existingSiblingPairs.add(pairKey(c.person_a_id, c.person_b_id))
    }
  }

  const byPair = new Map<string, Suggestion>()
  for (const [parentId, childrenSet] of childrenByParent) {
    const children = [...childrenSet]
    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        const key = pairKey(children[i], children[j])
        if (existingSiblingPairs.has(key)) continue
        const existing = byPair.get(key)
        if (existing) {
          existing.viaParentIds.push(parentId)
        } else {
          byPair.set(key, {
            personAId: children[i],
            personBId: children[j],
            kind: 'sibling',
            viaParentIds: [parentId],
          })
        }
      }
    }
  }
  return [...byPair.values()]
}

export const SuggestionsPanel = memo(function SuggestionsPanel({
  people,
  connections,
  onChanged,
}: {
  people: DbPerson[]
  connections: DbConnection[]
  onChanged: () => void
}) {
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const suggestions = useMemo(
    () => findSiblingSuggestions(connections),
    [connections],
  )

  const suggestionKey = (s: Suggestion) => pairKey(s.personAId, s.personBId)

  const [uncheckedKeys, setUncheckedKeys] = useState<Set<string>>(new Set())

  function toggle(key: string) {
    setUncheckedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selected = suggestions.filter(
    (s) => !uncheckedKeys.has(suggestionKey(s)),
  )

  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: () =>
      insertConnectionBatch({
        data: {
          connections: selected.map((s) => ({
            personAId: s.personAId,
            personBId: s.personBId,
            kind: s.kind,
          })),
        },
      }),
    onSuccess: (result) => {
      setUncheckedKeys(new Set())
      // Patch the created connections straight into the cache so the graph
      // updates immediately instead of waiting on onChanged()'s refetch.
      if (result.connections.length > 0) {
        queryClient.setQueryData<PeopleGraphData>(
          peopleGraphQueryOptions.queryKey,
          (old) =>
            old
              ? {
                  ...old,
                  connections: [...result.connections, ...old.connections],
                }
              : old,
        )
      }
      onChanged()
    },
  })

  if (suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="m-0 mb-3 text-sm font-semibold text-[var(--text)]">
          Suggestions
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          No suggestions right now — nothing shares a parent without already
          having a sibling connection.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-[var(--text)]">
        Suggestions
      </h2>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        People who share a parent but don't have a sibling connection yet.
        Uncheck any that aren't right, then add the rest.
      </p>

      <ul data-testid="suggestion-list" className="mb-3 flex flex-col gap-1.5">
        {suggestions.map((s) => {
          const key = suggestionKey(s)
          const nameA = peopleById.get(s.personAId)?.name ?? 'Unknown'
          const nameB = peopleById.get(s.personBId)?.name ?? 'Unknown'
          const viaNames = s.viaParentIds
            .map((id) => peopleById.get(id)?.name)
            .filter((name): name is string => !!name)
          return (
            <li
              key={key}
              data-testid="suggestion-item"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]"
            >
              <input
                type="checkbox"
                checked={!uncheckedKeys.has(key)}
                onChange={() => toggle(key)}
                aria-label={`Accept sibling suggestion: ${nameA} and ${nameB}`}
                data-testid="suggestion-checkbox"
              />
              <span className="text-[var(--text)]">
                {nameA}{' '}
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  sibling
                </span>{' '}
                {nameB}
                {viaNames.length > 0 && (
                  <span className="ml-1.5 text-xs italic text-[var(--text-muted)]">
                    via {viaNames.join(', ')}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => addMutation.mutate()}
          disabled={selected.length === 0 || addMutation.isPending}
          data-testid="suggestion-add-selected-btn"
          className="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          Add {selected.length} connection{selected.length === 1 ? '' : 's'}
        </button>
        <button
          type="button"
          onClick={() =>
            setUncheckedKeys(new Set(suggestions.map(suggestionKey)))
          }
          disabled={selected.length === 0}
          data-testid="suggestion-clear-btn"
          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50"
        >
          Uncheck all
        </button>
      </div>

      {addMutation.error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {addMutation.error instanceof Error
            ? addMutation.error.message
            : 'Could not add connections'}
        </p>
      )}

      {addMutation.isSuccess && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Added {addMutation.data.connections.length} connection
          {addMutation.data.connections.length === 1 ? '' : 's'}.
          {addMutation.data.skipped > 0 &&
            ` (${addMutation.data.skipped} already existed.)`}
        </p>
      )}
    </div>
  )
})
