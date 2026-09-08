import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { DbPerson } from '#/server/people'

// Delay so a mousedown on an option (which calls preventDefault) can commit
// before we close the list or clear a non-matching query.
const BLUR_CLOSE_DELAY_MS = 150

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
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listboxId = useId()

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
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setIsOpen(true)
    setActiveIndex(-1)
    if (value) emit('')
  }

  function handleBlur() {
    setTimeout(() => {
      setIsOpen(false)
      if (!value) setQuery('')
    }, BLUR_CLOSE_DELAY_MS)
  }

  function moveActive(delta: 1 | -1) {
    if (!isOpen) {
      setIsOpen(true)
      return
    }
    setActiveIndex((i) => {
      const next = i + delta
      if (next < 0) return results.length - 1
      if (next >= results.length) return 0
      return next
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault()
        commit(results[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery(selectedPerson?.name ?? '')
    }
  }

  return (
    <div className="relative min-w-0">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={(e) => {
          setIsOpen(true)
          e.target.select()
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        data-testid={testId}
        className={`w-36 ${className}`}
      />
      {isOpen && results.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          data-testid={`${testId}-listbox`}
          className="absolute left-0 top-full z-10 mt-1 max-h-56 w-max min-w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg"
        >
          {results.map((person, i) => (
            <div
              key={person.id}
              role="option"
              tabIndex={-1}
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(person)
              }}
              className={`cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm text-[var(--text)] ${
                i === activeIndex
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
