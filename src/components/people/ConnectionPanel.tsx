import { useMutation } from '@tanstack/react-query'
import { memo, useCallback, useMemo, useState } from 'react'
import { PersonCombobox } from '#/components/people/PersonCombobox'
import { selectClassName } from '#/components/people/styles'
import { CONNECTION_KIND_OPTIONS } from '#/lib/connectionKind'
import { usePatchPeopleGraph } from '#/lib/hooks/usePatchPeopleGraph'
import { usePeopleById } from '#/lib/hooks/usePeopleById'
import { getErrorMessage } from '#/lib/strings'
import {
  type ConnectionKind,
  type DbConnection,
  type DbPerson,
  deleteConnection,
  insertConnection,
  updateConnection,
} from '#/server/people'

const KIND_BADGE_STYLES: Record<ConnectionKind, string> = {
  partner: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  family: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  parent_child: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sibling: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  friend: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  coworker: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  other: 'bg-[var(--chip-bg)] text-[var(--text-muted)]',
}

// Both add and edit rows label their two person pickers "Parent"/"Child" for
// parent_child connections and "Person A"/"Person B" otherwise; edit rows
// additionally prefix the aria-label with "Edit ".
function personFieldLabel(
  kind: ConnectionKind,
  role: 'a' | 'b',
  mode: 'add' | 'edit',
): { placeholder: string; ariaLabel: string } {
  const isParentChild = kind === 'parent_child'
  const placeholder =
    role === 'a'
      ? isParentChild
        ? 'Parent'
        : 'Person A'
      : isParentChild
        ? 'Child'
        : 'Person B'
  if (mode === 'add') return { placeholder, ariaLabel: placeholder }
  const ariaLabel =
    role === 'a'
      ? isParentChild
        ? 'Edit parent'
        : 'Edit person A'
      : isParentChild
        ? 'Edit child'
        : 'Edit person B'
  return { placeholder, ariaLabel }
}

// ── ConnectionListItem ────────────────────────────────────────────────────────
const ConnectionListItem = memo(function ConnectionListItem({
  connection,
  personAName,
  personBName,
  onEdit,
  onDelete,
  disabled,
}: {
  connection: DbConnection
  personAName: string
  personBName: string
  onEdit: (connection: DbConnection) => void
  onDelete: (id: string) => void
  disabled: boolean
}) {
  return (
    <li
      data-testid="connection-list-item"
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]"
    >
      <span className="text-[var(--text)]">
        {personAName}{' '}
        <span
          data-testid="connection-kind-badge"
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_BADGE_STYLES[connection.kind]}`}
        >
          {connection.kind}
        </span>{' '}
        {personBName}
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
          onClick={() => onEdit(connection)}
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
        >
          Edit
        </button>
        <button
          type="button"
          data-testid="delete-connection-btn"
          onClick={() => onDelete(connection.id)}
          disabled={disabled}
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
        >
          Delete
        </button>
      </span>
    </li>
  )
})

export const ConnectionPanel = memo(function ConnectionPanel({
  people,
  connections,
  isStale = false,
  onChanged,
}: {
  people: DbPerson[]
  connections: DbConnection[]
  isStale?: boolean
  onChanged: (createdConnection?: DbConnection) => void
}) {
  const [personAId, setPersonAId] = useState('')
  const [personBId, setPersonBId] = useState('')
  const [kind, setKind] = useState<ConnectionKind>('other')
  const [label, setLabel] = useState('')
  const [connectionSearch, setConnectionSearch] = useState('')

  const peopleById = usePeopleById(people)

  const filteredConnections = useMemo(() => {
    const q = connectionSearch.trim().toLowerCase()
    if (!q) return connections
    return connections.filter((c) => {
      const nameA = peopleById.get(c.person_a_id)?.name.toLowerCase() ?? ''
      const nameB = peopleById.get(c.person_b_id)?.name.toLowerCase() ?? ''
      return nameA.includes(q) || nameB.includes(q) || c.kind.includes(q)
    })
  }, [connections, connectionSearch, peopleById])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPersonAId, setEditPersonAId] = useState('')
  const [editPersonBId, setEditPersonBId] = useState('')
  const [editKind, setEditKind] = useState<ConnectionKind>('other')
  const [editLabel, setEditLabel] = useState('')

  const patchPeopleGraph = usePatchPeopleGraph()

  const addMutation = useMutation({
    mutationFn: () =>
      insertConnection({ data: { personAId, personBId, kind, label } }),
    onSuccess: (connection) => {
      setLabel('')
      patchPeopleGraph((old) => ({
        ...old,
        connections: [connection, ...old.connections],
      }))
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
      patchPeopleGraph((old) => ({
        ...old,
        connections: old.connections.map((c) =>
          c.id === connection.id ? connection : c,
        ),
      }))
      onChanged(connection)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) =>
      deleteConnection({ data: { connectionId } }),
    onSuccess: (_result, connectionId) => {
      patchPeopleGraph((old) => ({
        ...old,
        connections: old.connections.filter((c) => c.id !== connectionId),
      }))
      onChanged()
    },
  })
  const { mutate: deleteConnectionMutate } = deleteMutation

  const canAdd =
    personAId && personBId && personAId !== personBId && !addMutation.isPending

  const canSaveEdit =
    editPersonAId &&
    editPersonBId &&
    editPersonAId !== editPersonBId &&
    !updateMutation.isPending

  const startEditing = useCallback((connection: DbConnection) => {
    setEditingId(connection.id)
    setEditPersonAId(connection.person_a_id)
    setEditPersonBId(connection.person_b_id)
    setEditKind(connection.kind)
    setEditLabel(connection.label ?? '')
  }, [])

  const swapEditDirection = useCallback(() => {
    setEditPersonAId(editPersonBId)
    setEditPersonBId(editPersonAId)
  }, [editPersonAId, editPersonBId])

  const handleDelete = useCallback(
    (connectionId: string) => deleteConnectionMutate(connectionId),
    [deleteConnectionMutate],
  )

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
        <PersonCombobox
          people={people}
          peopleById={peopleById}
          value={personAId}
          onChange={setPersonAId}
          {...personFieldLabel(kind, 'a', 'add')}
          testId="connection-person-a-select"
          className={`w-36 ${selectClassName}`}
        />

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

        <PersonCombobox
          people={people}
          peopleById={peopleById}
          value={personBId}
          onChange={setPersonBId}
          {...personFieldLabel(kind, 'b', 'add')}
          testId="connection-person-b-select"
          className={`w-36 ${selectClassName}`}
        />

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
          {getErrorMessage(addMutation.error, 'Could not add connection')}
        </p>
      )}

      {updateMutation.error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">
          {getErrorMessage(updateMutation.error, 'Could not update connection')}
        </p>
      )}

      <input
        type="search"
        value={connectionSearch}
        onChange={(e) => setConnectionSearch(e.target.value)}
        placeholder="Search connections…"
        aria-label="Search connections"
        className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--blue)]"
      />

      {filteredConnections.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          {connectionSearch ? 'No matches.' : 'No connections yet.'}
        </p>
      ) : (
        <div
          className={`max-h-80 overflow-y-auto transition-opacity duration-150 ${isStale ? 'opacity-50' : 'opacity-100'}`}
        >
          <ul data-testid="connection-list" className="flex flex-col gap-1.5">
            {filteredConnections.map((connection) => {
              if (editingId === connection.id) {
                return (
                  <li
                    key={connection.id}
                    data-testid="connection-list-item-editing"
                    className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5"
                  >
                    <PersonCombobox
                      people={people}
                      peopleById={peopleById}
                      value={editPersonAId}
                      onChange={setEditPersonAId}
                      {...personFieldLabel(editKind, 'a', 'edit')}
                      testId="connection-edit-person-a-select"
                      className={`w-36 ${selectClassName}`}
                    />

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

                    <PersonCombobox
                      people={people}
                      peopleById={peopleById}
                      value={editPersonBId}
                      onChange={setEditPersonBId}
                      {...personFieldLabel(editKind, 'b', 'edit')}
                      testId="connection-edit-person-b-select"
                      className={`w-36 ${selectClassName}`}
                    />

                    <button
                      type="button"
                      onClick={swapEditDirection}
                      disabled={!editPersonAId && !editPersonBId}
                      aria-label="Swap direction"
                      title={
                        editKind === 'parent_child'
                          ? 'Swap parent and child'
                          : 'Swap person A and person B'
                      }
                      data-testid="connection-edit-swap-btn"
                      className="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    >
                      ⇄
                    </button>

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
                <ConnectionListItem
                  key={connection.id}
                  connection={connection}
                  personAName={personA?.name ?? 'Unknown'}
                  personBName={personB?.name ?? 'Unknown'}
                  onEdit={startEditing}
                  onDelete={handleDelete}
                  disabled={deleteMutation.isPending}
                />
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
})
