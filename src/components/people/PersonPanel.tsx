import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { type DbPerson, deletePerson, insertPerson } from '#/server/people'

export function PersonPanel({
  people,
  onChanged,
}: {
  people: DbPerson[]
  onChanged: (createdPerson?: DbPerson) => void
}) {
  const [name, setName] = useState('')
  const id = useId()

  const addMutation = useMutation({
    mutationFn: () => insertPerson({ data: { name } }),
    onSuccess: (person) => {
      setName('')
      onChanged(person)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (personId: string) => deletePerson({ data: { personId } }),
    onSuccess: () => onChanged(),
  })

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
        <label htmlFor={id} className="sr-only">
          Name
        </label>
        <input
          id={id}
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

      {people.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No people yet.</p>
      ) : (
        <ul data-testid="person-list" className="flex flex-col gap-1.5">
          {people.map((person) => (
            <li
              key={person.id}
              data-testid="person-list-item"
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--hover-bg)]"
            >
              <span className="text-[var(--text)]">{person.name}</span>
              <button
                type="button"
                data-testid="delete-person-btn"
                onClick={() => {
                  if (
                    confirm(
                      `Delete "${person.name}"? Their connections go too.`,
                    )
                  ) {
                    deleteMutation.mutate(person.id)
                  }
                }}
                disabled={deleteMutation.isPending}
                className="rounded-full px-2 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
