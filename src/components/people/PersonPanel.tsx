import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { memo, useCallback, useId, useState } from 'react'
import { useDebouncedValue } from '#/lib/hooks/useDebouncedValue'
import { searchPeopleQueryOptions } from '#/lib/queries'
import {
  type DbPerson,
  deletePerson,
  insertPerson,
  updatePerson,
} from '#/server/people'

const PersonListItem = memo(function PersonListItem({
  person,
  onEdit,
  onDelete,
  onSelect,
  disabled,
}: {
  person: DbPerson
  onEdit: (person: DbPerson) => void
  onDelete: (id: string) => void
  onSelect?: (person: DbPerson) => void
  disabled: boolean
}) {
  return (
    <li
      data-testid="person-list-item"
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]"
    >
      <button
        type="button"
        onClick={() => onSelect?.(person)}
        className="min-w-0 flex-1 truncate text-left text-[var(--text)]"
      >
        {person.name}
      </button>
      <span className="flex gap-1.5">
        <button
          type="button"
          data-testid="edit-person-btn"
          onClick={() => onEdit(person)}
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
        >
          Edit
        </button>
        <button
          type="button"
          data-testid="delete-person-btn"
          onClick={() => {
            if (confirm(`Delete "${person.name}"? Their connections go too.`)) {
              onDelete(person.id)
            }
          }}
          disabled={disabled}
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
        >
          Delete
        </button>
      </span>
    </li>
  )
})

export const PersonPanel = memo(function PersonPanel({
  onChanged,
  onSelect,
}: {
  onChanged: (createdPerson?: DbPerson) => void
  onSelect?: (person: DbPerson) => void
}) {
  const [name, setName] = useState('')
  const formId = useId()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useDebouncedValue(300, '')

  const queryClient = useQueryClient()
  const { data, isFetching } = useQuery(
    searchPeopleQueryOptions(debouncedQuery),
  )
  const people = data?.people ?? []

  function invalidateSearch() {
    queryClient.invalidateQueries({ queryKey: ['searchPeople'] })
  }

  const addMutation = useMutation({
    mutationFn: () => insertPerson({ data: { name } }),
    onSuccess: (person) => {
      setName('')
      invalidateSearch()
      onChanged(person)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { personId: string; name: string }) =>
      updatePerson({ data: vars }),
    onSuccess: () => {
      setEditingId(null)
      invalidateSearch()
      onChanged()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (personId: string) => deletePerson({ data: { personId } }),
    onSuccess: () => {
      invalidateSearch()
      onChanged()
    },
  })
  const { mutate: deletePersonMutate } = deleteMutation

  const startEditing = useCallback((person: DbPerson) => {
    setEditingId(person.id)
    setEditingName(person.name)
  }, [])

  const handleDelete = useCallback(
    (personId: string) => deletePersonMutate(personId),
    [deletePersonMutate],
  )

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-[var(--text)]">
        People
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) addMutation.mutate()
        }}
        className="mb-3 flex gap-2"
      >
        <label htmlFor={formId} className="sr-only">
          Name
        </label>
        <input
          id={formId}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a person..."
          data-testid="person-name-input"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />
        <button
          type="submit"
          data-testid="add-person-btn"
          disabled={!name.trim() || addMutation.isPending}
          className="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {addMutation.error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">
          {addMutation.error instanceof Error
            ? addMutation.error.message
            : 'Could not add person'}
        </p>
      )}

      {updateMutation.error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">
          {updateMutation.error instanceof Error
            ? updateMutation.error.message
            : 'Could not update person'}
        </p>
      )}

      <input
        type="search"
        value={rawQuery}
        onChange={(e) => {
          setRawQuery(e.target.value)
          setDebouncedQuery(e.target.value)
        }}
        placeholder="Search people…"
        aria-label="Search people"
        className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--blue)]"
      />

      {people.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          {debouncedQuery ? 'No matches.' : 'No people yet.'}
        </p>
      ) : (
        <div
          className={`max-h-80 overflow-y-auto transition-opacity duration-150 ${isFetching ? 'opacity-50' : 'opacity-100'}`}
        >
          <ul data-testid="person-list" className="flex flex-col gap-1.5">
            {people.map((person) =>
              editingId === person.id ? (
                <li
                  key={person.id}
                  data-testid="person-list-item-editing"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                >
                  <input
                    type="text"
                    aria-label="Edit name"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    data-testid="person-edit-name-input"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
                  />
                  <button
                    type="button"
                    data-testid="save-person-btn"
                    disabled={!editingName.trim() || updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        personId: person.id,
                        name: editingName,
                      })
                    }
                    className="rounded-full bg-[var(--blue-deep)] px-2 py-0.5 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    data-testid="cancel-edit-person-btn"
                    onClick={() => setEditingId(null)}
                    className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
                  >
                    Cancel
                  </button>
                </li>
              ) : (
                <PersonListItem
                  key={person.id}
                  person={person}
                  onEdit={startEditing}
                  onDelete={handleDelete}
                  onSelect={onSelect}
                  disabled={deleteMutation.isPending}
                />
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  )
})
