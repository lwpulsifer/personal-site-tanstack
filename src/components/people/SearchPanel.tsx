import { useMemo, useState } from 'react'
import { CONNECTION_KIND_LABELS } from '#/lib/connectionKind'
import type { ConnectionKind, DbConnection, DbPerson } from '#/server/people'

// A "step" walks from the current set of people to everyone reachable via one
// relation. 'parent'/'child' use the directional parent_child convention
// (see connectionKind.ts); every other kind is symmetric.
type RelationStep = 'parent' | 'child' | Exclude<ConnectionKind, 'parent_child'>

const STEP_OPTIONS: { value: RelationStep; label: string }[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: CONNECTION_KIND_LABELS.sibling },
  { value: 'partner', label: CONNECTION_KIND_LABELS.partner },
  { value: 'family', label: CONNECTION_KIND_LABELS.family },
  { value: 'friend', label: CONNECTION_KIND_LABELS.friend },
  { value: 'coworker', label: CONNECTION_KIND_LABELS.coworker },
  { value: 'other', label: CONNECTION_KIND_LABELS.other },
]

const PRESETS: { label: string; steps: RelationStep[] }[] = [
  { label: 'Cousins', steps: ['parent', 'sibling', 'child'] },
  { label: 'Siblings', steps: ['parent', 'child'] },
  { label: 'Aunts/Uncles', steps: ['parent', 'sibling'] },
  { label: 'Grandparents', steps: ['parent', 'parent'] },
  { label: 'Grandchildren', steps: ['child', 'child'] },
]

const selectClassName =
  'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]'

function buildGraph(connections: DbConnection[]) {
  const parentToChildren = new Map<string, Set<string>>()
  const childToParents = new Map<string, Set<string>>()
  const byKind = new Map<ConnectionKind, Map<string, Set<string>>>()

  function addSymmetric(kind: ConnectionKind, a: string, b: string) {
    if (!byKind.has(kind)) byKind.set(kind, new Map())
    const map = byKind.get(kind) as Map<string, Set<string>>
    if (!map.has(a)) map.set(a, new Set())
    if (!map.has(b)) map.set(b, new Set())
    map.get(a)?.add(b)
    map.get(b)?.add(a)
  }

  for (const c of connections) {
    if (c.kind === 'parent_child') {
      if (!parentToChildren.has(c.person_a_id)) {
        parentToChildren.set(c.person_a_id, new Set())
      }
      parentToChildren.get(c.person_a_id)?.add(c.person_b_id)
      if (!childToParents.has(c.person_b_id)) {
        childToParents.set(c.person_b_id, new Set())
      }
      childToParents.get(c.person_b_id)?.add(c.person_a_id)
      continue
    }
    addSymmetric(c.kind, c.person_a_id, c.person_b_id)
  }

  return { parentToChildren, childToParents, byKind }
}

function applyStep(
  step: RelationStep,
  ids: Set<string>,
  graph: ReturnType<typeof buildGraph>,
): Set<string> {
  const result = new Set<string>()
  const source =
    step === 'parent'
      ? graph.childToParents
      : step === 'child'
        ? graph.parentToChildren
        : graph.byKind.get(step)
  if (!source) return result
  for (const id of ids) {
    for (const related of source.get(id) ?? []) result.add(related)
  }
  return result
}

export function SearchPanel({
  people,
  connections,
}: {
  people: DbPerson[]
  connections: DbConnection[]
}) {
  const [startId, setStartId] = useState('')
  const [steps, setSteps] = useState<RelationStep[]>([])
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const graph = useMemo(() => buildGraph(connections), [connections])

  const stages = useMemo(() => {
    if (!startId) return []
    let current = new Set([startId])
    const result: Set<string>[] = []
    for (const step of steps) {
      current = applyStep(step, current, graph)
      current.delete(startId)
      result.push(current)
    }
    return result
  }, [startId, steps, graph])

  const finalResult = stages.at(-1) ?? null

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setSteps(preset.steps)
    setCopyStatus('idle')
  }

  function addStep() {
    setSteps((prev) => [...prev, 'parent'])
    setCopyStatus('idle')
  }

  function updateStep(index: number, step: RelationStep) {
    setSteps((prev) => prev.map((s, i) => (i === index ? step : s)))
    setCopyStatus('idle')
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
    setCopyStatus('idle')
  }

  async function copyResultNames() {
    if (!finalResult) return
    const names = [...finalResult]
      .map((id) => peopleById.get(id)?.name)
      .filter((name): name is string => !!name)
      .sort((a, b) => a.localeCompare(b))
      .join('\n')
    try {
      await navigator.clipboard.writeText(names)
      setCopyStatus('copied')
    } catch {
      // Clipboard access can be denied by the browser; the list is still
      // visible on screen, so this is a nice-to-have, not worth surfacing
      // as an error.
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-[var(--text)]">
        Search
      </h2>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Pick a person, then build a chain of relations to walk from them — e.g.
        Parent → Sibling → Child finds their cousins. Requires parent/child
        connections (and sibling tags on parents, for cousins) to be entered.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Start person"
          value={startId}
          onChange={(e) => {
            setStartId(e.target.value)
            setCopyStatus('idle')
          }}
          data-testid="search-start-select"
          className={selectClassName}
        >
          <option value="">Start person…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            data-testid="search-preset-btn"
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2">
        {steps.map((step, index) => (
          // Steps are an ordered, position-addressed list with no stable
          // identity of their own — index is the correct key here.
          // biome-ignore lint/suspicious/noArrayIndexKey: steps have no other identity
          <div key={index} className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              {index + 1}.
            </span>
            <select
              aria-label={`Step ${index + 1} relation`}
              value={step}
              onChange={(e) =>
                updateStep(index, e.target.value as RelationStep)
              }
              data-testid="search-step-select"
              className={selectClassName}
            >
              {STEP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeStep(index)}
              aria-label={`Remove step ${index + 1}`}
              data-testid="search-remove-step-btn"
              className="rounded-full px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
            >
              ×
            </button>
            {startId && (
              <span
                data-testid="search-stage-count"
                className="text-xs text-[var(--text-muted)]"
              >
                → {stages[index]?.size ?? 0}{' '}
                {stages[index]?.size === 1 ? 'person' : 'people'}
              </span>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addStep}
          data-testid="search-add-step-btn"
          className="self-start rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
        >
          + Add step
        </button>
      </div>

      {!startId && (
        <p className="text-xs text-[var(--text-muted)]">
          Pick a start person to run the query.
        </p>
      )}

      {startId && steps.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Add a step, or pick a preset, to build a query.
        </p>
      )}

      {startId && finalResult && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="m-0 text-xs font-semibold text-[var(--text)]">
              Result — {finalResult.size}{' '}
              {finalResult.size === 1 ? 'person' : 'people'}
            </p>
            {finalResult.size > 0 && (
              <button
                type="button"
                onClick={copyResultNames}
                data-testid="search-copy-btn"
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
              >
                {copyStatus === 'copied' ? 'Copied!' : 'Copy names'}
              </button>
            )}
          </div>
          {finalResult.size === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              No one matched — check that the relevant connections are entered.
            </p>
          ) : (
            <ul
              data-testid="search-result-list"
              className="flex flex-wrap gap-1.5"
            >
              {[...finalResult]
                .map((id) => peopleById.get(id))
                .filter((p): p is DbPerson => p != null)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <li
                    key={p.id}
                    data-testid="search-result-item"
                    className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--text)]"
                  >
                    {p.name}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
