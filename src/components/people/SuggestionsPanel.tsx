import { useMutation } from '@tanstack/react-query'
import { memo, useMemo, useState } from 'react'
import { usePatchPeopleGraph } from '#/lib/hooks/usePatchPeopleGraph'
import { usePeopleById } from '#/lib/hooks/usePeopleById'
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

// personAId is the parent to add, personBId is the sibling missing that
// parent connection (matches the parent_child convention elsewhere).
type ParentDuplicationSuggestion = {
  personAId: string
  personBId: string
  kind: ConnectionKind
  // Sibling(s) who already have this parent connection, motivating the fix.
  viaSiblingIds: string[]
}

type SiblingWithoutParent = {
  personAId: string
  personBId: string
}

function pairKey(a: string, b: string) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join(':')
}

// Unlike pairKey, this preserves order — used for parent_child edges, where
// direction (who's the parent) matters.
function directedKey(a: string, b: string) {
  return `${a}:${b}`
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

// The reverse data-quality check: existing sibling connections where the two
// people don't share any parent_child connection to a common parent.
//
// When at least one of the two already has a known parent, the fix is
// unambiguous: duplicate that parent_child connection onto the other sibling
// too (`parentFixSuggestions`, actionable just like findSiblingSuggestions
// above). When NEITHER has any parent connection yet, there's nothing to
// duplicate — those pairs are surfaced read-only in `noParentPairs` for a
// human to investigate (missing parent data on both sides, or a wrong
// sibling tag).
function analyzeSiblingParentGaps(connections: DbConnection[]): {
  parentFixSuggestions: ParentDuplicationSuggestion[]
  noParentPairs: SiblingWithoutParent[]
} {
  const parentsByChild = new Map<string, Set<string>>()
  const existingParentChild = new Set<string>()
  for (const c of connections) {
    if (c.kind !== 'parent_child') continue
    if (c.person_a_id === c.person_b_id) continue
    existingParentChild.add(directedKey(c.person_a_id, c.person_b_id))
    if (!parentsByChild.has(c.person_b_id)) {
      parentsByChild.set(c.person_b_id, new Set())
    }
    parentsByChild.get(c.person_b_id)?.add(c.person_a_id)
  }

  function addFix(
    fixByKey: Map<string, ParentDuplicationSuggestion>,
    parentId: string,
    childId: string,
    viaSiblingId: string,
  ) {
    if (existingParentChild.has(directedKey(parentId, childId))) return
    const key = directedKey(parentId, childId)
    const existing = fixByKey.get(key)
    if (existing) {
      existing.viaSiblingIds.push(viaSiblingId)
    } else {
      fixByKey.set(key, {
        personAId: parentId,
        personBId: childId,
        kind: 'parent_child',
        viaSiblingIds: [viaSiblingId],
      })
    }
  }

  const seenSiblingPairs = new Set<string>()
  const fixByKey = new Map<string, ParentDuplicationSuggestion>()
  const noParentPairs: SiblingWithoutParent[] = []

  for (const c of connections) {
    if (c.kind !== 'sibling') continue
    const key = pairKey(c.person_a_id, c.person_b_id)
    if (seenSiblingPairs.has(key)) continue
    seenSiblingPairs.add(key)

    const [siblingA, siblingB] = [c.person_a_id, c.person_b_id]
    const parentsA = parentsByChild.get(siblingA) ?? new Set<string>()
    const parentsB = parentsByChild.get(siblingB) ?? new Set<string>()
    if ([...parentsA].some((p) => parentsB.has(p))) continue // already shares a parent

    if (parentsA.size === 0 && parentsB.size === 0) {
      noParentPairs.push({ personAId: siblingA, personBId: siblingB })
      continue
    }

    for (const parentId of parentsA)
      addFix(fixByKey, parentId, siblingB, siblingA)
    for (const parentId of parentsB)
      addFix(fixByKey, parentId, siblingA, siblingB)
  }

  return { parentFixSuggestions: [...fixByKey.values()], noParentPairs }
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
  const peopleById = usePeopleById(people)
  const patchPeopleGraph = usePatchPeopleGraph()

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
        patchPeopleGraph((old) => ({
          ...old,
          connections: [...result.connections, ...old.connections],
        }))
      }
      onChanged()
    },
  })

  const { parentFixSuggestions, noParentPairs } = useMemo(
    () => analyzeSiblingParentGaps(connections),
    [connections],
  )
  const parentFixKey = (s: ParentDuplicationSuggestion) =>
    directedKey(s.personAId, s.personBId)
  const [uncheckedParentFixKeys, setUncheckedParentFixKeys] = useState<
    Set<string>
  >(new Set())
  function toggleParentFix(key: string) {
    setUncheckedParentFixKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const selectedParentFixes = parentFixSuggestions.filter(
    (s) => !uncheckedParentFixKeys.has(parentFixKey(s)),
  )
  const addParentFixMutation = useMutation({
    mutationFn: () =>
      insertConnectionBatch({
        data: {
          connections: selectedParentFixes.map((s) => ({
            personAId: s.personAId,
            personBId: s.personBId,
            kind: s.kind,
          })),
        },
      }),
    onSuccess: (result) => {
      setUncheckedParentFixKeys(new Set())
      if (result.connections.length > 0) {
        patchPeopleGraph((old) => ({
          ...old,
          connections: [...result.connections, ...old.connections],
        }))
      }
      onChanged()
    },
  })

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-[var(--text)]">
        Suggestions
      </h2>

      {suggestions.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">
          No suggestions right now — nothing shares a parent without already
          having a sibling connection.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            People who share a parent but don't have a sibling connection yet.
            Uncheck any that aren't right, then add the rest.
          </p>

          <ul
            data-testid="suggestion-list"
            className="mb-3 flex flex-col gap-1.5"
          >
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
        </>
      )}

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Data quality: siblings without a shared parent
        </h3>

        {parentFixSuggestions.length === 0 && noParentPairs.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            No issues found — every sibling connection shares at least one
            parent.
          </p>
        ) : (
          <>
            {parentFixSuggestions.length > 0 && (
              <>
                <p className="mb-2 text-xs text-[var(--text-muted)]">
                  One sibling already has a parent connection the other is
                  missing. Uncheck any that aren't right, then add the rest to
                  duplicate them.
                </p>

                <ul
                  data-testid="parent-fix-list"
                  className="mb-3 flex flex-col gap-1.5"
                >
                  {parentFixSuggestions.map((s) => {
                    const key = parentFixKey(s)
                    const parentName =
                      peopleById.get(s.personAId)?.name ?? 'Unknown'
                    const childName =
                      peopleById.get(s.personBId)?.name ?? 'Unknown'
                    const viaNames = s.viaSiblingIds
                      .map((id) => peopleById.get(id)?.name)
                      .filter((name): name is string => !!name)
                    return (
                      <li
                        key={key}
                        data-testid="parent-fix-item"
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]"
                      >
                        <input
                          type="checkbox"
                          checked={!uncheckedParentFixKeys.has(key)}
                          onChange={() => toggleParentFix(key)}
                          aria-label={`Add ${parentName} as a parent of ${childName}`}
                          data-testid="parent-fix-checkbox"
                        />
                        <span className="text-[var(--text)]">
                          {parentName}{' '}
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            parent of
                          </span>{' '}
                          {childName}
                          {viaNames.length > 0 && (
                            <span className="ml-1.5 text-xs italic text-[var(--text-muted)]">
                              via sibling {viaNames.join(', ')}
                            </span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addParentFixMutation.mutate()}
                    disabled={
                      selectedParentFixes.length === 0 ||
                      addParentFixMutation.isPending
                    }
                    data-testid="parent-fix-add-selected-btn"
                    className="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
                  >
                    Add {selectedParentFixes.length} connection
                    {selectedParentFixes.length === 1 ? '' : 's'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setUncheckedParentFixKeys(
                        new Set(parentFixSuggestions.map(parentFixKey)),
                      )
                    }
                    disabled={selectedParentFixes.length === 0}
                    data-testid="parent-fix-clear-btn"
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50"
                  >
                    Uncheck all
                  </button>
                </div>

                {addParentFixMutation.error && (
                  <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                    {addParentFixMutation.error instanceof Error
                      ? addParentFixMutation.error.message
                      : 'Could not add connections'}
                  </p>
                )}

                {addParentFixMutation.isSuccess && (
                  <p className="mb-3 text-xs text-[var(--text-muted)]">
                    Added {addParentFixMutation.data.connections.length}{' '}
                    connection
                    {addParentFixMutation.data.connections.length === 1
                      ? ''
                      : 's'}
                    .
                    {addParentFixMutation.data.skipped > 0 &&
                      ` (${addParentFixMutation.data.skipped} already existed.)`}
                  </p>
                )}
              </>
            )}

            {noParentPairs.length > 0 && (
              <>
                <p className="mb-2 text-xs text-[var(--text-muted)]">
                  Neither person has a parent connection yet, so there's nothing
                  to duplicate here — review manually.
                </p>
                <ul
                  data-testid="sibling-without-parent-list"
                  className="flex flex-col gap-1.5"
                >
                  {noParentPairs.map((pair) => {
                    const nameA =
                      peopleById.get(pair.personAId)?.name ?? 'Unknown'
                    const nameB =
                      peopleById.get(pair.personBId)?.name ?? 'Unknown'
                    return (
                      <li
                        key={pairKey(pair.personAId, pair.personBId)}
                        data-testid="sibling-without-parent-item"
                        className="rounded-lg px-2 py-1.5 text-sm text-[var(--text)]"
                      >
                        {nameA}{' '}
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          sibling
                        </span>{' '}
                        {nameB}
                        <span className="ml-1.5 text-xs italic text-[var(--text-muted)]">
                          — no shared parent found
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
})
