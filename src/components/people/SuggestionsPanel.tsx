import { createMemo, createSignal, For, Show } from 'solid-js'
import { createPeopleById } from '../../lib/peopleById'
import {
  type ConnectionKind,
  type DbConnection,
  type DbPerson,
  insertConnectionBatch,
} from '../../server/people'

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

type BatchResult = { connections: DbConnection[]; skipped: number }

const checkRowClass =
  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]'
const primaryBtnClass =
  'rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50'
const secondaryBtnClass =
  'rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50'
const amberBadge =
  'rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400'

const plural = (n: number) => (n === 1 ? '' : 's')

// A set of unchecked keys with toggle / reset helpers; everything is checked by default.
function createUncheckedSet() {
  const [unchecked, setUnchecked] = createSignal<Set<string>>(new Set<string>())
  return {
    unchecked,
    toggle(key: string) {
      setUnchecked((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    set: (keys: Iterable<string>) => setUnchecked(new Set<string>(keys)),
    clear: () => setUnchecked(new Set<string>()),
  }
}

// Runs a batch insert of the checked suggestions, tracking pending/error/result.
function createBatchAdd(
  items: () => { personAId: string; personBId: string; kind: ConnectionKind }[],
  onDone: () => void,
) {
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<unknown>(null)
  const [result, setResult] = createSignal<BatchResult | null>(null)
  async function run() {
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = (await insertConnectionBatch({
        connections: items().map((s) => ({
          personAId: s.personAId,
          personBId: s.personBId,
          kind: s.kind,
        })),
      })) as BatchResult
      setResult(res)
      onDone()
    } catch (e) {
      setError(e)
    } finally {
      setPending(false)
    }
  }
  return { pending, error, result, run }
}

export function SuggestionsPanel(props: {
  people: DbPerson[]
  connections: DbConnection[]
  onChanged: () => void
}) {
  const peopleById = createPeopleById(() => props.people)
  const nameOf = (id: string) => peopleById().get(id)?.name ?? 'Unknown'
  const namesOf = (ids: string[]) =>
    ids.map((id) => peopleById().get(id)?.name).filter((name): name is string => !!name)

  // ── Siblings sharing a parent ────────────────────────────────────────────
  const suggestions = createMemo(() => findSiblingSuggestions(props.connections))
  const suggestionKey = (s: Suggestion) => pairKey(s.personAId, s.personBId)
  const siblingChecks = createUncheckedSet()
  const selected = createMemo(() =>
    suggestions().filter((s) => !siblingChecks.unchecked().has(suggestionKey(s))),
  )
  const siblingAdd = createBatchAdd(selected, () => {
    siblingChecks.clear()
    props.onChanged()
  })

  // ── Siblings without a shared parent ─────────────────────────────────────
  const gaps = createMemo(() => analyzeSiblingParentGaps(props.connections))
  const parentFixSuggestions = () => gaps().parentFixSuggestions
  const noParentPairs = () => gaps().noParentPairs
  const parentFixKey = (s: ParentDuplicationSuggestion) => directedKey(s.personAId, s.personBId)
  const parentFixChecks = createUncheckedSet()
  const selectedParentFixes = createMemo(() =>
    parentFixSuggestions().filter((s) => !parentFixChecks.unchecked().has(parentFixKey(s))),
  )
  const parentFixAdd = createBatchAdd(selectedParentFixes, () => {
    parentFixChecks.clear()
    props.onChanged()
  })

  const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not add connections')
  const addedText = (r: BatchResult) =>
    `Added ${r.connections.length} connection${plural(r.connections.length)}.${
      r.skipped > 0 ? ` (${r.skipped} already existed.)` : ''
    }`

  return (
    <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 class="m-0 mb-3 text-sm font-semibold text-[var(--text)]">Data quality checks</h2>

      <div>
        <h3 class="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Siblings sharing a parent
        </h3>

        <Show
          when={suggestions().length > 0}
          fallback={
            <p class="text-xs text-[var(--text-muted)]">
              No suggestions right now — nothing shares a parent without already having a sibling
              connection.
            </p>
          }
        >
          <p class="mb-3 text-xs text-[var(--text-muted)]">
            People who share a parent but don't have a sibling connection yet. Uncheck any that
            aren't right, then add the rest.
          </p>

          <ul data-testid="suggestion-list" class="mb-3 flex flex-col gap-1.5">
            <For each={suggestions()}>
              {(s) => {
                const key = suggestionKey(s)
                return (
                  <li data-testid="suggestion-item" class={checkRowClass}>
                    <input
                      type="checkbox"
                      checked={!siblingChecks.unchecked().has(key)}
                      onChange={() => siblingChecks.toggle(key)}
                      aria-label={`Accept sibling suggestion: ${nameOf(s.personAId)} and ${nameOf(s.personBId)}`}
                      data-testid="suggestion-checkbox"
                    />
                    <span class="text-[var(--text)]">
                      {nameOf(s.personAId)} <span class={amberBadge}>sibling</span>{' '}
                      {nameOf(s.personBId)}
                      <Show when={namesOf(s.viaParentIds).length > 0}>
                        <span class="ml-1.5 text-xs italic text-[var(--text-muted)]">
                          via {namesOf(s.viaParentIds).join(', ')}
                        </span>
                      </Show>
                    </span>
                  </li>
                )
              }}
            </For>
          </ul>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={siblingAdd.run}
              disabled={selected().length === 0 || siblingAdd.pending()}
              data-testid="suggestion-add-selected-btn"
              class={primaryBtnClass}
            >
              Add {selected().length} connection{plural(selected().length)}
            </button>
            <button
              type="button"
              onClick={() => siblingChecks.set(suggestions().map(suggestionKey))}
              disabled={selected().length === 0}
              data-testid="suggestion-clear-btn"
              class={secondaryBtnClass}
            >
              Uncheck all
            </button>
          </div>

          <Show when={siblingAdd.error()}>
            <p class="mt-2 text-xs text-red-600 dark:text-red-400">{errorText(siblingAdd.error())}</p>
          </Show>
          <Show when={siblingAdd.result()}>
            {(r) => <p class="mt-2 text-xs text-[var(--text-muted)]">{addedText(r())}</p>}
          </Show>
        </Show>
      </div>

      <div class="mt-4 border-t border-[var(--border)] pt-4">
        <h3 class="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Siblings without a shared parent
        </h3>

        <Show
          when={parentFixSuggestions().length > 0 || noParentPairs().length > 0}
          fallback={
            <p class="text-xs text-[var(--text-muted)]">
              No issues found — every sibling connection shares at least one parent.
            </p>
          }
        >
          <Show when={parentFixSuggestions().length > 0}>
            <p class="mb-2 text-xs text-[var(--text-muted)]">
              One sibling already has a parent connection the other is missing. Uncheck any that
              aren't right, then add the rest to duplicate them.
            </p>

            <ul data-testid="parent-fix-list" class="mb-3 flex flex-col gap-1.5">
              <For each={parentFixSuggestions()}>
                {(s) => {
                  const key = parentFixKey(s)
                  return (
                    <li data-testid="parent-fix-item" class={checkRowClass}>
                      <input
                        type="checkbox"
                        checked={!parentFixChecks.unchecked().has(key)}
                        onChange={() => parentFixChecks.toggle(key)}
                        aria-label={`Add ${nameOf(s.personAId)} as a parent of ${nameOf(s.personBId)}`}
                        data-testid="parent-fix-checkbox"
                      />
                      <span class="text-[var(--text)]">
                        {nameOf(s.personAId)} <span class={amberBadge}>parent of</span>{' '}
                        {nameOf(s.personBId)}
                        <Show when={namesOf(s.viaSiblingIds).length > 0}>
                          <span class="ml-1.5 text-xs italic text-[var(--text-muted)]">
                            via sibling {namesOf(s.viaSiblingIds).join(', ')}
                          </span>
                        </Show>
                      </span>
                    </li>
                  )
                }}
              </For>
            </ul>

            <div class="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={parentFixAdd.run}
                disabled={selectedParentFixes().length === 0 || parentFixAdd.pending()}
                data-testid="parent-fix-add-selected-btn"
                class={primaryBtnClass}
              >
                Add {selectedParentFixes().length} connection{plural(selectedParentFixes().length)}
              </button>
              <button
                type="button"
                onClick={() => parentFixChecks.set(parentFixSuggestions().map(parentFixKey))}
                disabled={selectedParentFixes().length === 0}
                data-testid="parent-fix-clear-btn"
                class={secondaryBtnClass}
              >
                Uncheck all
              </button>
            </div>

            <Show when={parentFixAdd.error()}>
              <p class="mb-3 text-xs text-red-600 dark:text-red-400">
                {errorText(parentFixAdd.error())}
              </p>
            </Show>
            <Show when={parentFixAdd.result()}>
              {(r) => <p class="mb-3 text-xs text-[var(--text-muted)]">{addedText(r())}</p>}
            </Show>
          </Show>

          <Show when={noParentPairs().length > 0}>
            <p class="mb-2 text-xs text-[var(--text-muted)]">
              Neither person has a parent connection yet, so there's nothing to duplicate here —
              review manually.
            </p>
            <ul data-testid="sibling-without-parent-list" class="flex flex-col gap-1.5">
              <For each={noParentPairs()}>
                {(pair) => (
                  <li
                    data-testid="sibling-without-parent-item"
                    class="rounded-lg px-2 py-1.5 text-sm text-[var(--text)]"
                  >
                    {nameOf(pair.personAId)} <span class={amberBadge}>sibling</span>{' '}
                    {nameOf(pair.personBId)}
                    <span class="ml-1.5 text-xs italic text-[var(--text-muted)]">
                      — no shared parent found
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </div>
    </div>
  )
}
