import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  type ConnectionKind,
  type DbConnection,
  type DbPerson,
  deleteConnection,
  insertConnection,
} from '#/server/people'

const KIND_OPTIONS: { value: ConnectionKind; label: string }[] = [
  { value: 'other', label: 'Other' },
  { value: 'family', label: 'Family' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'coworker', label: 'Coworker' },
  { value: 'partner', label: 'Partner' },
]

// Small visual cue in the connection list — matches the tighter bonding
// partners get in the graph (see PeopleGraph.client.tsx).
const KIND_BADGE_STYLES: Record<ConnectionKind, string> = {
  partner: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  family: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sibling: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  friend: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  coworker: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  other: '',
}

export function ConnectionPanel({
  people,
  connections,
  onChanged,
}: {
  people: DbPerson[]
  connections: DbConnection[]
  onChanged: () => void
}) {
  const [personAId, setPersonAId] = useState('')
  const [personBId, setPersonBId] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<ConnectionKind>('other')
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const addMutation = useMutation({
    mutationFn: () =>
      insertConnection({ data: { personAId, personBId, label, kind } }),
    onSuccess: () => {
      setLabel('')
      onChanged()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) =>
      deleteConnection({ data: { connectionId } }),
    onSuccess: onChanged,
  })

  const canAdd =
    personAId &&
    personBId &&
    personAId !== personBId &&
    label.trim() &&
    !addMutation.isPending

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-[var(--text)]">
        Connections
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canAdd) addMutation.mutate()
        }}
        className="mb-3 flex flex-wrap items-center gap-2"
      >
        <select
          aria-label="Person A"
          value={personAId}
          onChange={(e) => setPersonAId(e.target.value)}
          data-testid="connection-person-a-select"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        >
          <option value="">Person A</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          aria-label="Relationship"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="relationship (e.g. brother)"
          data-testid="connection-label-input"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />

        <select
          aria-label="Person B"
          value={personBId}
          onChange={(e) => setPersonBId(e.target.value)}
          data-testid="connection-person-b-select"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        >
          <option value="">Person B</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Relationship type"
          value={kind}
          onChange={(e) => setKind(e.target.value as ConnectionKind)}
          data-testid="connection-kind-select"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          data-testid="add-connection-btn"
          disabled={!canAdd}
          className="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {addMutation.error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">
          {addMutation.error instanceof Error
            ? addMutation.error.message
            : 'Could not add connection'}
        </p>
      )}

      {connections.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No connections yet.</p>
      ) : (
        <ul data-testid="connection-list" className="flex flex-col gap-1.5">
          {connections.map((connection) => {
            const personA = peopleById.get(connection.person_a_id)
            const personB = peopleById.get(connection.person_b_id)
            return (
              <li
                key={connection.id}
                data-testid="connection-list-item"
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]"
              >
                <span className="text-[var(--text)]">
                  {personA?.name ?? 'Unknown'}{' '}
                  <span className="text-[var(--text-muted)]">
                    — {connection.label} —
                  </span>{' '}
                  {personB?.name ?? 'Unknown'}
                  {connection.kind !== 'other' && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_BADGE_STYLES[connection.kind]}`}
                    >
                      {connection.kind}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  data-testid="delete-connection-btn"
                  onClick={() => deleteMutation.mutate(connection.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-full px-2 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
