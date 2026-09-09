import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useComboboxNav } from '#/lib/hooks/useComboboxNav'
import type { DbPerson } from '#/server/people'

interface SearchablePerson {
  person: DbPerson
  lowerName: string
}

// Contains-match on the name, with names that start with the query ranked
// ahead of names that merely contain it elsewhere; ties break alphabetically.
function searchPeople(
  searchable: SearchablePerson[],
  query: string,
): DbPerson[] {
  const q = query.trim().toLowerCase()
  if (!q) return searchable.map((s) => s.person)
  return searchable
    .filter((s) => s.lowerName.includes(q))
    .sort((a, b) => {
      const aPrefix = a.lowerName.startsWith(q)
      const bPrefix = b.lowerName.startsWith(q)
      if (aPrefix !== bPrefix) return aPrefix ? -1 : 1
      return a.person.name.localeCompare(b.person.name)
    })
    .map((s) => s.person)
}

// A single-person picker styled and behaving like a search-as-you-type
// combobox rather than a native <select>: it supports contains-based
// filtering (with prefix matches ranked first) instead of requiring an
// exact-prefix jump-to-option like a real <select> does.
export const PersonCombobox = memo(function PersonCombobox({
  people,
  peopleById,
  value,
  onChange,
  placeholder,
  ariaLabel,
  testId,
  className,
}: {
  people: DbPerson[]
  peopleById: Map<string, DbPerson>
  value: string
  onChange: (id: string) => void
  placeholder: string
  ariaLabel: string
  testId: string
  className: string
}) {
  const selectedPerson = useMemo(
    () => peopleById.get(value) ?? null,
    [peopleById, value],
  )
  const [query, setQuery] = useState(selectedPerson?.name ?? '')

  // Tracks the id we last told the parent about, so the sync effect below
  // can tell "the parent changed `value` out from under us" (swap button,
  // entering edit mode, a reset) apart from "we just emitted this ourselves"
  // (which must NOT stomp on text the user is actively typing).
  const lastEmittedRef = useRef(value)

  // Read via a ref rather than a dependency so a data refetch (which gives
  // `peopleById` a new reference without actually changing `value`) doesn't
  // re-run this effect.
  const peopleByIdRef = useRef(peopleById)
  peopleByIdRef.current = peopleById

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value
      setQuery(peopleByIdRef.current.get(value)?.name ?? '')
    }
  }, [value])

  const searchable = useMemo(
    () =>
      people.map((person) => ({
        person,
        lowerName: person.name.toLowerCase(),
      })),
    [people],
  )
  const results = useMemo(
    () => searchPeople(searchable, query),
    [searchable, query],
  )

  function emit(id: string) {
    lastEmittedRef.current = id
    onChange(id)
  }

  function commit(person: DbPerson) {
    emit(person.id)
    setQuery(person.name)
    nav.setIsOpen(false)
  }

  const nav = useComboboxNav({
    resultCount: results.length,
    onCommit: (index) => commit(results[index]),
    onEscape: () => setQuery(selectedPerson?.name ?? ''),
    // Clicking away without picking anything abandons unsaved typing.
    onOutsideClose: () => {
      if (!value) setQuery('')
    },
  })

  // Auto-highlight the top match once the user has typed something, so
  // Enter commits it directly without requiring an arrow-key press first.
  // Leave nothing highlighted while the query is empty (just browsing the
  // full list) so a stray Enter can't commit an arbitrary person.
  useEffect(() => {
    nav.setActiveIndex(query.trim() && results.length > 0 ? 0 : -1)
  }, [query, results, nav.setActiveIndex])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    nav.setIsOpen(true)
    if (value) emit('')
  }

  return (
    <div ref={nav.containerRef} className="relative min-w-0">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={(e) => {
          nav.setIsOpen(true)
          e.target.select()
        }}
        onKeyDown={nav.handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={nav.isOpen}
        aria-controls={nav.listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        data-testid={testId}
        className={className}
      />
      {nav.isOpen && results.length > 0 && (
        <div
          id={nav.listboxId}
          role="listbox"
          data-testid={`${testId}-listbox`}
          className="absolute left-0 top-full z-10 mt-1 max-h-56 w-max min-w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg"
        >
          {results.map((person, i) => (
            <div
              key={person.id}
              role="option"
              tabIndex={-1}
              aria-selected={i === nav.activeIndex}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(person)
              }}
              className={`cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm text-[var(--text)] ${
                i === nav.activeIndex
                  ? 'bg-[var(--hover-bg)]'
                  : 'hover:bg-[var(--hover-bg)]'
              }`}
            >
              {person.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
