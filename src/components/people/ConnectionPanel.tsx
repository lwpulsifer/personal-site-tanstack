import { createMemo, createSignal, For, Show } from 'solid-js'
import { CONNECTION_KIND_OPTIONS } from '../../lib/connectionKind'
import { createPeopleById } from '../../lib/peopleById'
import {
  type ConnectionKind,
  type DbConnection,
  type DbPerson,
  deleteConnection,
  insertConnection,
  updateConnection,
} from '../../server/people'
import { PersonCombobox } from './PersonCombobox'
import { selectClassName } from './styles'

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
    role === 'a' ? (isParentChild ? 'Parent' : 'Person A') : isParentChild ? 'Child' : 'Person B'
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

function KindOptions(props: { selected: ConnectionKind }) {
  return (
    <For each={CONNECTION_KIND_OPTIONS}>
      {(opt) => (
        <option value={opt.value} selected={opt.value === props.selected}>
          {opt.label}
        </option>
      )}
    </For>
  )
}

function ConnectionListItem(props: {
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
      class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]"
    >
      <span class="text-[var(--text)]">
        {props.personAName}{' '}
        <span
          data-testid="connection-kind-badge"
          class={`rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_BADGE_STYLES[props.connection.kind]}`}
        >
          {props.connection.kind}
        </span>{' '}
        {props.personBName}
        <Show when={props.connection.label}>
          <span class="ml-1.5 text-xs italic text-[var(--text-muted)]">
            "{props.connection.label}"
          </span>
        </Show>
      </span>
      <span class="flex gap-1.5">
        <button
          type="button"
          data-testid="edit-connection-btn"
          onClick={() => props.onEdit(props.connection)}
          class="rounded-full px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
        >
          Edit
        </button>
        <button
          type="button"
          data-testid="delete-connection-btn"
          onClick={() => props.onDelete(props.connection.id)}
          disabled={props.disabled}
          class="rounded-full px-2 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
        >
          Delete
        </button>
      </span>
    </li>
  )
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

export function ConnectionPanel(props: {
  people: DbPerson[]
  connections: DbConnection[]
  isStale?: boolean
  onChanged: (createdConnection?: DbConnection) => void
}) {
  const [personAId, setPersonAId] = createSignal('')
  const [personBId, setPersonBId] = createSignal('')
  const [kind, setKind] = createSignal<ConnectionKind>('other')
  const [label, setLabel] = createSignal('')
  const [connectionSearch, setConnectionSearch] = createSignal('')

  const peopleById = createPeopleById(() => props.people)

  const filteredConnections = createMemo(() => {
    const q = connectionSearch().trim().toLowerCase()
    if (!q) return props.connections
    return props.connections.filter((c) => {
      const nameA = peopleById().get(c.person_a_id)?.name.toLowerCase() ?? ''
      const nameB = peopleById().get(c.person_b_id)?.name.toLowerCase() ?? ''
      return nameA.includes(q) || nameB.includes(q) || c.kind.includes(q)
    })
  })

  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editPersonAId, setEditPersonAId] = createSignal('')
  const [editPersonBId, setEditPersonBId] = createSignal('')
  const [editKind, setEditKind] = createSignal<ConnectionKind>('other')
  const [editLabel, setEditLabel] = createSignal('')

  const [adding, setAdding] = createSignal(false)
  const [updating, setUpdating] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const [addError, setAddError] = createSignal<unknown>(null)
  const [updateError, setUpdateError] = createSignal<unknown>(null)

  // Mutations name the query keys they touch, so the graph data revalidates on its own.
  async function add() {
    setAdding(true)
    setAddError(null)
    try {
      const connection = (await insertConnection({
        personAId: personAId(),
        personBId: personBId(),
        kind: kind(),
        label: label(),
      })) as DbConnection
      setLabel('')
      props.onChanged(connection)
    } catch (e) {
      setAddError(e)
    } finally {
      setAdding(false)
    }
  }

  async function saveEdit(connectionId: string) {
    setUpdating(true)
    setUpdateError(null)
    try {
      const connection = (await updateConnection({
        connectionId,
        personAId: editPersonAId(),
        personBId: editPersonBId(),
        kind: editKind(),
        label: editLabel(),
      })) as DbConnection
      setEditingId(null)
      props.onChanged(connection)
    } catch (e) {
      setUpdateError(e)
    } finally {
      setUpdating(false)
    }
  }

  async function remove(connectionId: string) {
    setDeleting(true)
    try {
      await deleteConnection(connectionId)
      props.onChanged()
    } finally {
      setDeleting(false)
    }
  }

  const canAdd = () => personAId() && personBId() && personAId() !== personBId() && !adding()
  const canSaveEdit = () =>
    editPersonAId() && editPersonBId() && editPersonAId() !== editPersonBId() && !updating()

  function startEditing(connection: DbConnection) {
    setEditingId(connection.id)
    setEditPersonAId(connection.person_a_id)
    setEditPersonBId(connection.person_b_id)
    setEditKind(connection.kind)
    setEditLabel(connection.label ?? '')
  }

  function swapEditDirection() {
    const a = editPersonAId()
    const b = editPersonBId()
    setEditPersonAId(b)
    setEditPersonBId(a)
  }

  const textInputClass =
    'min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]'

  return (
    <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 class="m-0 mb-3 text-sm font-semibold text-[var(--text)]">Connections</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canAdd()) add()
        }}
        class="mb-3 flex flex-wrap items-center gap-2"
      >
        <PersonCombobox
          people={props.people}
          peopleById={peopleById()}
          value={personAId()}
          onChange={setPersonAId}
          placeholder={personFieldLabel(kind(), 'a', 'add').placeholder}
          ariaLabel={personFieldLabel(kind(), 'a', 'add').ariaLabel}
          testId="connection-person-a-select"
          class={`w-36 ${selectClassName}`}
        />

        <select
          aria-label="Relationship type"
          onChange={(e) => setKind(e.currentTarget.value as ConnectionKind)}
          data-testid="connection-kind-select"
          class={`${selectClassName} font-semibold`}
        >
          <KindOptions selected={kind()} />
        </select>

        <PersonCombobox
          people={props.people}
          peopleById={peopleById()}
          value={personBId()}
          onChange={setPersonBId}
          placeholder={personFieldLabel(kind(), 'b', 'add').placeholder}
          ariaLabel={personFieldLabel(kind(), 'b', 'add').ariaLabel}
          testId="connection-person-b-select"
          class={`w-36 ${selectClassName}`}
        />

        <input
          type="text"
          aria-label="Comment (optional)"
          value={label()}
          onInput={(e) => setLabel(e.currentTarget.value)}
          placeholder="comment (optional)"
          data-testid="connection-label-input"
          class={textInputClass}
        />

        <button
          type="submit"
          data-testid="add-connection-btn"
          disabled={!canAdd()}
          class="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <Show when={addError()}>
        <p class="mb-3 text-xs text-red-600 dark:text-red-400">
          {errorText(addError(), 'Could not add connection')}
        </p>
      </Show>
      <Show when={updateError()}>
        <p class="mb-3 text-xs text-red-600 dark:text-red-400">
          {errorText(updateError(), 'Could not update connection')}
        </p>
      </Show>

      <input
        type="search"
        value={connectionSearch()}
        onInput={(e) => setConnectionSearch(e.currentTarget.value)}
        placeholder="Search connections…"
        aria-label="Search connections"
        class="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--blue)]"
      />

      <Show
        when={filteredConnections().length > 0}
        fallback={
          <p class="text-sm text-[var(--text-muted)]">
            {connectionSearch() ? 'No matches.' : 'No connections yet.'}
          </p>
        }
      >
        <div
          class={`max-h-80 overflow-y-auto transition-opacity duration-150 ${props.isStale ? 'opacity-50' : 'opacity-100'}`}
        >
          <ul data-testid="connection-list" class="flex flex-col gap-1.5">
            <For each={filteredConnections()}>
              {(connection) => (
                <Show
                  when={editingId() === connection.id}
                  fallback={
                    <ConnectionListItem
                      connection={connection}
                      personAName={peopleById().get(connection.person_a_id)?.name ?? 'Unknown'}
                      personBName={peopleById().get(connection.person_b_id)?.name ?? 'Unknown'}
                      onEdit={startEditing}
                      onDelete={remove}
                      disabled={deleting()}
                    />
                  }
                >
                  <li
                    data-testid="connection-list-item-editing"
                    class="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5"
                  >
                    <PersonCombobox
                      people={props.people}
                      peopleById={peopleById()}
                      value={editPersonAId()}
                      onChange={setEditPersonAId}
                      placeholder={personFieldLabel(editKind(), 'a', 'edit').placeholder}
                      ariaLabel={personFieldLabel(editKind(), 'a', 'edit').ariaLabel}
                      testId="connection-edit-person-a-select"
                      class={`w-36 ${selectClassName}`}
                    />

                    <select
                      aria-label="Edit relationship type"
                      onChange={(e) => setEditKind(e.currentTarget.value as ConnectionKind)}
                      data-testid="connection-edit-kind-select"
                      class={`${selectClassName} font-semibold`}
                    >
                      <KindOptions selected={editKind()} />
                    </select>

                    <PersonCombobox
                      people={props.people}
                      peopleById={peopleById()}
                      value={editPersonBId()}
                      onChange={setEditPersonBId}
                      placeholder={personFieldLabel(editKind(), 'b', 'edit').placeholder}
                      ariaLabel={personFieldLabel(editKind(), 'b', 'edit').ariaLabel}
                      testId="connection-edit-person-b-select"
                      class={`w-36 ${selectClassName}`}
                    />

                    <button
                      type="button"
                      onClick={swapEditDirection}
                      disabled={!editPersonAId() && !editPersonBId()}
                      aria-label="Swap direction"
                      title={
                        editKind() === 'parent_child'
                          ? 'Swap parent and child'
                          : 'Swap person A and person B'
                      }
                      data-testid="connection-edit-swap-btn"
                      class="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    >
                      ⇄
                    </button>

                    <input
                      type="text"
                      aria-label="Edit comment (optional)"
                      value={editLabel()}
                      onInput={(e) => setEditLabel(e.currentTarget.value)}
                      placeholder="comment (optional)"
                      data-testid="connection-edit-label-input"
                      class={textInputClass}
                    />

                    <button
                      type="button"
                      data-testid="save-connection-btn"
                      disabled={!canSaveEdit()}
                      onClick={() => saveEdit(connection.id)}
                      class="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      data-testid="cancel-edit-connection-btn"
                      onClick={() => setEditingId(null)}
                      class="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
                    >
                      Cancel
                    </button>
                  </li>
                </Show>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  )
}
