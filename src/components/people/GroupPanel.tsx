import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { CONNECTION_KIND_OPTIONS } from '#/lib/connectionKind'
import {
  type ConnectionKind,
  type DbPerson,
  insertConnectionGroup,
} from '#/server/people'

const selectClassName =
  'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]'

// Picks people by name into a chip list, keyed by id (not name — names
// aren't guaranteed unique) so a selected person always maps back to exactly
// one row in `people`.
function PeoplePicker({
  people,
  selectedIds,
  onChange,
}: {
  people: DbPerson[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = selectedIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is DbPerson => p != null)

  const q = query.trim().toLowerCase()
  const suggestions = q
    ? people
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) && !selectedIds.includes(p.id),
        )
        .slice(0, 8)
    : []

  function addPerson(person: DbPerson) {
    onChange([...selectedIds, person.id])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function removePerson(id: string) {
    onChange(selectedIds.filter((existingId) => existingId !== id))
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 transition focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[rgba(59,130,246,0.2)]">
        {selected.map((person) => (
          <span
            key={person.id}
            data-testid="group-person-chip"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--text)]"
          >
            {person.name}
            <button
              type="button"
              onClick={() => removePerson(person.id)}
              className="leading-none text-[var(--text-muted)] hover:text-[var(--text)]"
              aria-label={`Remove ${person.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions[0]) {
              e.preventDefault()
              addPerson(suggestions[0])
            } else if (e.key === 'Backspace' && !query && selected.length > 0) {
              removePerson(selected[selected.length - 1].id)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder={selected.length === 0 ? 'Add people…' : ''}
          aria-label="Group members"
          data-testid="group-people-input"
          className="min-w-20 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul
          data-testid="group-people-suggestions"
          className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg"
        >
          {suggestions.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  addPerson(person)
                }}
                className="w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-bg)]"
              >
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function GroupPanel({
  people,
  onChanged,
}: {
  people: DbPerson[]
  onChanged: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [kind, setKind] = useState<ConnectionKind>('other')
  const [label, setLabel] = useState('')

  const groupMutation = useMutation({
    mutationFn: () =>
      insertConnectionGroup({ data: { personIds: selectedIds, kind, label } }),
    onSuccess: () => {
      setSelectedIds([])
      setLabel('')
      onChanged()
    },
  })

  const canCreate = selectedIds.length >= 2 && !groupMutation.isPending

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-[var(--text)]">
        Groups
      </h2>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Pick a set of people and a relationship type to connect every one of
        them to every other one — e.g. a friend group or a household.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canCreate) groupMutation.mutate()
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <PeoplePicker
          people={people}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />

        <select
          aria-label="Group relationship type"
          value={kind}
          onChange={(e) => setKind(e.target.value as ConnectionKind)}
          data-testid="group-kind-select"
          className={`${selectClassName} font-semibold`}
        >
          {CONNECTION_KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          aria-label="Group comment (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="comment (optional)"
          data-testid="group-label-input"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />

        <button
          type="submit"
          data-testid="create-group-btn"
          disabled={!canCreate}
          className="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          Create group
        </button>
      </form>

      {selectedIds.length === 1 && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Add at least one more person to form a group.
        </p>
      )}

      {groupMutation.error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {groupMutation.error instanceof Error
            ? groupMutation.error.message
            : 'Could not create group'}
        </p>
      )}

      {groupMutation.isSuccess && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Created {groupMutation.data.connections.length} connection
          {groupMutation.data.connections.length === 1 ? '' : 's'}.
          {groupMutation.data.skipped > 0 &&
            ` (${groupMutation.data.skipped} already existed.)`}
        </p>
      )}
    </div>
  )
}
