import { createMemo, createSignal, createUniqueId, For, isPending, Show } from 'solid-js'
import { createDebounced } from '../../lib/hooks/createDebounced'
import {
  type DbPerson,
  deletePerson,
  insertPerson,
  searchPeople,
  updatePerson,
} from '../../server/people'

function PersonListItem(props: {
  person: DbPerson
  onEdit: (person: DbPerson) => void
  onDelete: (id: string) => void
  onSelect?: (person: DbPerson) => void
  disabled: boolean
}) {
  return (
    <li
      data-testid="person-list-item"
      class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]"
    >
      <button
        type="button"
        onClick={() => props.onSelect?.(props.person)}
        class="min-w-0 flex-1 truncate text-left text-[var(--text)]"
      >
        {props.person.name}
      </button>
      <span class="flex gap-1.5">
        <button
          type="button"
          data-testid="edit-person-btn"
          onClick={() => props.onEdit(props.person)}
          class="rounded-full px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
        >
          Edit
        </button>
        <button
          type="button"
          data-testid="delete-person-btn"
          onClick={() => {
            if (confirm(`Delete "${props.person.name}"? Their connections go too.`)) {
              props.onDelete(props.person.id)
            }
          }}
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

export function PersonPanel(props: {
  onChanged: (createdPerson?: DbPerson) => void
  onSelect?: (person: DbPerson) => void
}) {
  const [name, setName] = createSignal('')
  const formId = createUniqueId()
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editingName, setEditingName] = createSignal('')
  const [rawQuery, setRawQuery] = createSignal('')
  const [debouncedQuery, setDebouncedQuery] = createDebounced(300, '')
  const [adding, setAdding] = createSignal(false)
  const [updating, setUpdating] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const [addError, setAddError] = createSignal<unknown>(null)
  const [updateError, setUpdateError] = createSignal<unknown>(null)

  // Mutations are server functions naming the keys they touch, so this search
  // result (and the page's graph data) revalidate on their own afterwards.
  const result = createMemo(() => searchPeople(debouncedQuery(), 100, 0))
  const people = () => result().people
  // Dims the list while a new search (or a revalidation) is in flight.
  const isFetching = () => isPending(() => result())

  async function add() {
    setAdding(true)
    setAddError(null)
    try {
      const person = (await insertPerson(name())) as DbPerson
      setName('')
      props.onChanged(person)
    } catch (e) {
      setAddError(e)
    } finally {
      setAdding(false)
    }
  }

  async function save(personId: string) {
    setUpdating(true)
    setUpdateError(null)
    try {
      await updatePerson(personId, editingName())
      setEditingId(null)
      props.onChanged()
    } catch (e) {
      setUpdateError(e)
    } finally {
      setUpdating(false)
    }
  }

  async function remove(personId: string) {
    setDeleting(true)
    try {
      await deletePerson(personId)
      props.onChanged()
    } finally {
      setDeleting(false)
    }
  }

  function startEditing(person: DbPerson) {
    setEditingId(person.id)
    setEditingName(person.name)
  }

  return (
    <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 class="m-0 mb-3 text-sm font-semibold text-[var(--text)]">People</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name().trim()) add()
        }}
        class="mb-3 flex gap-2"
      >
        <label for={formId} class="sr-only">Name</label>
        <input
          id={formId}
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="Add a person..."
          data-testid="person-name-input"
          class="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />
        <button
          type="submit"
          data-testid="add-person-btn"
          disabled={!name().trim() || adding()}
          class="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <Show when={addError()}>
        <p class="mb-3 text-xs text-red-600 dark:text-red-400">
          {errorText(addError(), 'Could not add person')}
        </p>
      </Show>
      <Show when={updateError()}>
        <p class="mb-3 text-xs text-red-600 dark:text-red-400">
          {errorText(updateError(), 'Could not update person')}
        </p>
      </Show>

      <input
        type="search"
        value={rawQuery()}
        onInput={(e) => {
          setRawQuery(e.currentTarget.value)
          setDebouncedQuery(e.currentTarget.value)
        }}
        placeholder="Search people…"
        aria-label="Search people"
        class="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--blue)]"
      />

      <Show
        when={people().length > 0}
        fallback={
          <p class="text-sm text-[var(--text-muted)]">
            {debouncedQuery() ? 'No matches.' : 'No people yet.'}
          </p>
        }
      >
        <div
          class={`max-h-80 overflow-y-auto transition-opacity duration-150 ${isFetching() ? 'opacity-50' : 'opacity-100'}`}
        >
          <ul data-testid="person-list" class="flex flex-col gap-1.5">
            <For each={people()}>
              {(person) => (
                <Show
                  when={editingId() === person.id}
                  fallback={
                    <PersonListItem
                      person={person}
                      onEdit={startEditing}
                      onDelete={remove}
                      onSelect={props.onSelect}
                      disabled={deleting()}
                    />
                  }
                >
                  <li
                    data-testid="person-list-item-editing"
                    class="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  >
                    <input
                      type="text"
                      aria-label="Edit name"
                      value={editingName()}
                      onInput={(e) => setEditingName(e.currentTarget.value)}
                      data-testid="person-edit-name-input"
                      class="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
                    />
                    <button
                      type="button"
                      data-testid="save-person-btn"
                      disabled={!editingName().trim() || updating()}
                      onClick={() => save(person.id)}
                      class="rounded-full bg-[var(--blue-deep)] px-2 py-0.5 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      data-testid="cancel-edit-person-btn"
                      onClick={() => setEditingId(null)}
                      class="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
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
