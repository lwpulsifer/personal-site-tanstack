import { createEffect, createMemo, createSignal, For, Show, untrack } from 'solid-js'
import { createComboboxNav } from '../../lib/hooks/createComboboxNav'
import type { DbPerson } from '../../server/people'

interface SearchablePerson {
  person: DbPerson
  lowerName: string
}

// Contains-match on the name, with names that start with the query ranked
// ahead of names that merely contain it elsewhere; ties break alphabetically.
function searchPeople(searchable: SearchablePerson[], query: string): DbPerson[] {
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
// combobox rather than a native <select>: contains-based filtering (prefix
// matches ranked first) instead of an exact-prefix jump-to-option.
export function PersonCombobox(props: {
  people: DbPerson[]
  peopleById: Map<string, DbPerson>
  value: string
  onChange: (id: string) => void
  placeholder: string
  ariaLabel: string
  testId: string
  class: string
}) {
  const selectedPerson = createMemo(() => props.peopleById.get(props.value) ?? null)
  // Seeded once from the initial selection; the sync effect below handles later changes.
  const [query, setQuery] = createSignal(untrack(() => selectedPerson()?.name ?? ''))

  // Tracks the id we last told the parent about, so the sync effect below can
  // tell "the parent changed `value` out from under us" (swap button, entering
  // edit mode, a reset) apart from "we just emitted this ourselves" (which
  // must NOT stomp on text the user is actively typing).
  let lastEmitted = untrack(() => props.value)

  createEffect(
    () => props.value,
    (value) => {
      if (value !== lastEmitted) {
        lastEmitted = value
        setQuery(props.peopleById.get(value)?.name ?? '')
      }
    },
  )

  const searchable = createMemo(() =>
    props.people.map((person) => ({ person, lowerName: person.name.toLowerCase() })),
  )
  const results = createMemo(() => searchPeople(searchable(), query()))

  function emit(id: string) {
    lastEmitted = id
    props.onChange(id)
  }

  function commit(person: DbPerson) {
    emit(person.id)
    setQuery(person.name)
    nav.setIsOpen(false)
  }

  const nav = createComboboxNav({
    resultCount: () => results().length,
    onCommit: (index) => commit(results()[index]),
    onEscape: () => setQuery(selectedPerson()?.name ?? ''),
    // Clicking away without picking anything abandons unsaved typing.
    onOutsideClose: () => {
      if (!props.value) setQuery('')
    },
  })

  // Auto-highlight the top match once the user has typed something, so Enter
  // commits it directly. Nothing is highlighted while the query is empty so a
  // stray Enter can't commit an arbitrary person.
  createEffect(
    () => (query().trim() && results().length > 0 ? 0 : -1),
    (index) => {
      nav.setActiveIndex(index)
    },
  )

  return (
    <div ref={nav.setContainer} class="relative min-w-0">
      <input
        type="text"
        value={query()}
        onInput={(e) => {
          setQuery(e.currentTarget.value)
          nav.setIsOpen(true)
          if (props.value) emit('')
        }}
        onFocus={(e) => {
          nav.setIsOpen(true)
          e.currentTarget.select()
        }}
        onKeyDown={nav.handleKeyDown}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel}
        role="combobox"
        aria-expanded={nav.isOpen() ? 'true' : 'false'}
        aria-controls={nav.listboxId}
        aria-autocomplete="list"
        autocomplete="off"
        data-testid={props.testId}
        class={props.class}
      />
      <Show when={nav.isOpen() && results().length > 0}>
        <div
          id={nav.listboxId}
          role="listbox"
          data-testid={`${props.testId}-listbox`}
          class="absolute left-0 top-full z-10 mt-1 max-h-56 w-max min-w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg"
        >
          <For each={results()}>
            {(person, i) => (
              <div
                role="option"
                tabindex={-1}
                aria-selected={i() === nav.activeIndex() ? 'true' : 'false'}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(person)
                }}
                class={`cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm text-[var(--text)] ${
                  i() === nav.activeIndex() ? 'bg-[var(--hover-bg)]' : 'hover:bg-[var(--hover-bg)]'
                }`}
              >
                {person.name}
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
