import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { CONNECTION_KIND_OPTIONS } from '#/lib/connectionKind'
import {
  type ConnectionKind,
  type DbConnection,
  type DbPerson,
  deleteConnection,
  insertConnection,
  updateConnection,
} from '#/server/people'

// Matches the tighter bonding partners get in the graph (see PeopleGraph.client.tsx).
const KIND_BADGE_STYLES: Record<ConnectionKind, string> = {
  partner: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  family: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  parent_child: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sibling: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  friend: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  coworker: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  other: 'bg-[var(--chip-bg)] text-[var(--text-muted)]',
}

const selectClassName =
  'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]'

export function ConnectionPanel({
  people,
  connections,
  onChanged,
}: {
  people: DbPerson[]
  connections: DbConnection[]
  onChanged: (createdConnection?: DbConnection) => void
}) {
  const [personAId, setPersonAId] = useState('')
  const [personBId, setPersonBId] = useState('')
  const [kind, setKind] = useState<ConnectionKind>('other')
  const [label, setLabel] = useState('')
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPersonAId, setEditPersonAId] = useState('')
  const [editPersonBId, setEditPersonBId] = useState('')
  const [editKind, setEditKind] = useState<ConnectionKind>('other')
  const [editLabel, setEditLabel] = useState('')

  const addMutation = useMutation({
    mutationFn: () =>
      insertConnection({ data: { personAId, personBId, kind, label } }),
    onSuccess: (connection) => {
      setLabel('')
      onChanged(connection)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (vars: {
      connectionId: string
      personAId: string
      personBId: string
      kind: ConnectionKind
      label: string
    }) => updateConnection({ data: vars }),
    onSuccess: (connection) => {
      setEditingId(null)
      onChanged(connection)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) =>
      deleteConnection({ data: { connectionId } }),
    onSuccess: () => onChanged(),
  })

  const canAdd =
    personAId && personBId && personAId !== personBId && !addMutation.isPending

  const canSaveEdit =
    editPersonAId &&
    editPersonBId &&
    editPersonAId !== editPersonBId &&
    !updateMutation.isPending

  function startEditing(connection: DbConnection) {
    setEditingId(connection.id)
    setEditPersonAId(connection.person_a_id)
    setEditPersonBId(connection.person_b_id)
    setEditKind(connection.kind)
    setEditLabel(connection.label ?? '')
  }

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
          className={selectClassName}
        >
          <option value="">Person A</option>
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
          className={`${selectClassName} font-semibold`}
        >
          {CONNECTION_KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Person B"
          value={personBId}
          onChange={(e) => setPersonBId(e.target.value)}
          data-testid="connection-person-b-select"
          className={selectClassName}
        >
          <option value="">Person B</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          aria-label="Comment (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="comment (optional)"
          data-testid="connection-label-input"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />

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

      {updateMutation.error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">
          {updateMutation.error instanceof Error
            ? updateMutation.error.message
            : 'Could not update connection'}
        </p>
      )}

      {connections.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No connections yet.</p>
      ) : (
        <ul data-testid="connection-list" className="flex flex-col gap-1.5">
          {connections.map((connection) => {
            if (editingId === connection.id) {
              return (
                <li
                  key={connection.id}
                  data-testid="connection-list-item-editing"
                  className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5"
                >
                  <select
                    aria-label="Edit person A"
                    value={editPersonAId}
                    onChange={(e) => setEditPersonAId(e.target.value)}
                    data-testid="connection-edit-person-a-select"
                    className={selectClassName}
                  >
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Edit relationship type"
                    value={editKind}
                    onChange={(e) =>
                      setEditKind(e.target.value as ConnectionKind)
                    }
                    data-testid="connection-edit-kind-select"
                    className={`${selectClassName} font-semibold`}
                  >
                    {CONNECTION_KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Edit person B"
                    value={editPersonBId}
                    onChange={(e) => setEditPersonBId(e.target.value)}
                    data-testid="connection-edit-person-b-select"
                    className={selectClassName}
                  >
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    aria-label="Edit comment (optional)"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="comment (optional)"
                    data-testid="connection-edit-label-input"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
                  />

                  <button
                    type="button"
                    data-testid="save-connection-btn"
                    disabled={!canSaveEdit}
                    onClick={() =>
                      updateMutation.mutate({
                        connectionId: connection.id,
                        personAId: editPersonAId,
                        personBId: editPersonBId,
                        kind: editKind,
                        label: editLabel,
                      })
                    }
                    className="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    data-testid="cancel-edit-connection-btn"
                    onClick={() => setEditingId(null)}
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
                  >
                    Cancel
                  </button>
                </li>
              )
            }

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
                  <span
                    data-testid="connection-kind-badge"
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_BADGE_STYLES[connection.kind]}`}
                  >
                    {connection.kind}
                  </span>{' '}
                  {personB?.name ?? 'Unknown'}
                  {connection.label && (
                    <span className="ml-1.5 text-xs italic text-[var(--text-muted)]">
                      "{connection.label}"
                    </span>
                  )}
                </span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    data-testid="edit-connection-btn"
                    onClick={() => startEditing(connection)}
                    className="rounded-full px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    data-testid="delete-connection-btn"
                    onClick={() => deleteMutation.mutate(connection.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-full px-2 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                  >
                    Delete
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
