import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { CONNECTION_KIND_OPTIONS } from '../../lib/connectionKind'
import { createComboboxNav } from '../../lib/hooks/createComboboxNav'
import { createPeopleById } from '../../lib/peopleById'
import {
  type ConnectionKind,
  type DbConnection,
  type DbPerson,
  type InsertConnectionGroupInput,
  insertConnectionGroup,
} from '../../server/people'
import { PersonCombobox } from './PersonCombobox'
import { selectClassName } from './styles'

// Picks people by name into a chip list, keyed by id (not name — names
// aren't guaranteed unique) so a selected person always maps back to exactly
// one row in `people`.
function PeoplePicker(props: {
  people: DbPerson[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  // A person picked elsewhere (e.g. the star-mode anchor) who shouldn't be
  // offered here too.
  excludeId?: string
}) {
  const [query, setQuery] = createSignal('')
  let inputEl!: HTMLInputElement

  const selected = createMemo(() =>
    props.selectedIds
      .map((id) => props.people.find((p) => p.id === id))
      .filter((p): p is DbPerson => p != null),
  )

  const suggestions = createMemo(() => {
    const q = query().trim().toLowerCase()
    if (!q) return []
    return props.people
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) &&
          !props.selectedIds.includes(p.id) &&
          p.id !== props.excludeId,
      )
      .slice(0, 8)
  })

  function addPerson(person: DbPerson) {
    props.onChange([...props.selectedIds, person.id])
    setQuery('')
    nav.setIsOpen(false)
    inputEl.focus()
  }

  function removePerson(id: string) {
    props.onChange(props.selectedIds.filter((existingId) => existingId !== id))
  }

  const nav = createComboboxNav({
    resultCount: () => suggestions().length,
    onCommit: (index) => addPerson(suggestions()[index]),
  })

  // Auto-highlight the top match once the user has typed something, so Enter
  // commits it directly — matching PersonCombobox's behavior.
  createEffect(
    () => (query().trim() && suggestions().length > 0 ? 0 : -1),
    (index) => {
      nav.setActiveIndex(index)
    },
  )

  return (
    <div ref={nav.setContainer} class="relative min-w-0 flex-1">
      <div class="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 transition focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[rgba(59,130,246,0.2)]">
        <For each={selected()}>
          {(person) => (
            <span
              data-testid="group-person-chip"
              class="inline-flex items-center gap-1 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--text)]"
            >
              {person.name}
              <button
                type="button"
                onClick={() => removePerson(person.id)}
                class="leading-none text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label={`Remove ${person.name}`}
              >
                ×
              </button>
            </span>
          )}
        </For>
        <input
          ref={inputEl}
          type="text"
          value={query()}
          onInput={(e) => {
            setQuery(e.currentTarget.value)
            nav.setIsOpen(true)
          }}
          onFocus={() => nav.setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !query() && selected().length > 0) {
              removePerson(selected()[selected().length - 1].id)
              return
            }
            nav.handleKeyDown(e)
          }}
          placeholder={selected().length === 0 ? 'Add people…' : ''}
          aria-label="Group members"
          role="combobox"
          aria-expanded={nav.isOpen() ? 'true' : 'false'}
          aria-controls={nav.listboxId}
          aria-autocomplete="list"
          autocomplete="off"
          data-testid="group-people-input"
          class="min-w-20 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
        />
      </div>

      <Show when={nav.isOpen() && suggestions().length > 0}>
        <div
          id={nav.listboxId}
          role="listbox"
          aria-label="Suggested people"
          data-testid="group-people-suggestions"
          class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg"
        >
          <For each={suggestions()}>
            {(person, i) => (
              <div
                role="option"
                tabindex={-1}
                aria-selected={i() === nav.activeIndex() ? 'true' : 'false'}
                onMouseDown={(e) => {
                  e.preventDefault()
                  addPerson(person)
                }}
                class={`cursor-pointer px-3 py-2 text-sm text-[var(--text)] ${
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

type GroupMode = 'clique' | 'star'

const modeToggleClass = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-semibold transition ${
    active
      ? 'bg-[var(--blue-deep)] text-white'
      : 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--hover-bg)]'
  }`

type GroupResult = { connections: DbConnection[]; skipped: number }

export function GroupPanel(props: { people: DbPerson[]; onChanged: () => void }) {
  const [mode, setMode] = createSignal<GroupMode>('clique')
  const [selectedIds, setSelectedIds] = createSignal<string[]>([])
  const [anchorId, setAnchorId] = createSignal('')
  const [kind, setKind] = createSignal<ConnectionKind>('other')
  const [label, setLabel] = createSignal('')
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<unknown>(null)
  const [result, setResult] = createSignal<GroupResult | null>(null)

  const peopleById = createPeopleById(() => props.people)
  const anchorCandidates = createMemo(() => props.people.filter((p) => !selectedIds().includes(p.id)))

  async function create() {
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const star = mode() === 'star'
      // Server-function args are JSON: only include anchorId when it's used.
      const input: InsertConnectionGroupInput = {
        personIds: star ? Array.from(new Set([anchorId(), ...selectedIds()])) : selectedIds(),
        kind: kind(),
        label: label(),
        mode: mode(),
        ...(star ? { anchorId: anchorId() } : {}),
      }
      const res = (await insertConnectionGroup(input)) as GroupResult
      // Anchor/members are left as-is so the same set can be reused for another
      // relationship kind without re-picking everyone; only the one-off comment
      // is cleared. The Clear button resets everything.
      setLabel('')
      setResult(res)
      props.onChanged()
    } catch (e) {
      setError(e)
    } finally {
      setPending(false)
    }
  }

  const canCreate = () =>
    (mode() === 'clique'
      ? selectedIds().length >= 2
      : anchorId() !== '' && selectedIds().length >= 1) && !pending()

  function switchMode(nextMode: GroupMode) {
    setMode(nextMode)
    setAnchorId('')
  }

  function handleClear() {
    setSelectedIds([])
    setAnchorId('')
    setLabel('')
    setError(null)
    setResult(null)
  }

  return (
    <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 class="m-0 mb-3 text-sm font-semibold text-[var(--text)]">Groups</h2>

      <div class="mb-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => switchMode('clique')}
          data-testid="group-mode-clique-btn"
          class={modeToggleClass(mode() === 'clique')}
        >
          Everyone ↔ everyone
        </button>
        <button
          type="button"
          onClick={() => switchMode('star')}
          data-testid="group-mode-star-btn"
          class={modeToggleClass(mode() === 'star')}
        >
          One person → everyone else
        </button>
      </div>

      <p class="mb-3 text-xs text-[var(--text-muted)]">
        {mode() === 'clique'
          ? 'Pick a set of people and a relationship type to connect every one of them to every other one — e.g. a friend group or a household.'
          : "Pick one anchor person and a set of others to connect the anchor to each of them, without connecting the others to each other — e.g. one person's several coworkers."}
        <Show when={mode() === 'star' && kind() === 'parent_child'}>
          {' '}With Parent-Child, the anchor is the parent of everyone else.
        </Show>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canCreate()) create()
        }}
        class="flex flex-wrap items-center gap-2"
      >
        <Show when={mode() === 'star'}>
          <PersonCombobox
            people={anchorCandidates()}
            peopleById={peopleById()}
            value={anchorId()}
            onChange={(id) => {
              setAnchorId(id)
              setSelectedIds((ids) => ids.filter((existing) => existing !== id))
            }}
            placeholder="Anchor person…"
            ariaLabel="Anchor person"
            testId="group-anchor-select"
            class={`w-36 ${selectClassName}`}
          />
        </Show>

        <PeoplePicker
          people={props.people}
          selectedIds={selectedIds()}
          onChange={setSelectedIds}
          excludeId={mode() === 'star' ? anchorId() || undefined : undefined}
        />

        <select
          aria-label="Group relationship type"
          onChange={(e) => setKind(e.currentTarget.value as ConnectionKind)}
          data-testid="group-kind-select"
          class={`${selectClassName} font-semibold`}
        >
          <For each={CONNECTION_KIND_OPTIONS}>
            {(opt) => (
              <option value={opt.value} selected={opt.value === kind()}>
                {opt.label}
              </option>
            )}
          </For>
        </select>

        <input
          type="text"
          aria-label="Group comment (optional)"
          value={label()}
          onInput={(e) => setLabel(e.currentTarget.value)}
          placeholder="comment (optional)"
          data-testid="group-label-input"
          class="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />

        <button
          type="submit"
          data-testid="create-group-btn"
          disabled={!canCreate()}
          class="rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          {mode() === 'clique' ? 'Create group' : 'Connect'}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={selectedIds().length === 0 && anchorId() === '' && label() === ''}
          data-testid="group-clear-btn"
          class="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50"
        >
          Clear
        </button>
      </form>

      <Show when={mode() === 'clique' && selectedIds().length === 1}>
        <p class="mt-2 text-xs text-[var(--text-muted)]">Add at least one more person.</p>
      </Show>
      <Show when={mode() === 'star' && anchorId() === ''}>
        <p class="mt-2 text-xs text-[var(--text-muted)]">Pick an anchor person.</p>
      </Show>
      <Show when={mode() === 'star' && anchorId() !== '' && selectedIds().length === 0}>
        <p class="mt-2 text-xs text-[var(--text-muted)]">
          Add at least one other person to connect the anchor to.
        </p>
      </Show>

      <Show when={error()}>
        <p class="mt-2 text-xs text-red-600 dark:text-red-400">
          {error() instanceof Error ? (error() as Error).message : 'Could not create connections'}
        </p>
      </Show>

      <Show when={result()}>
        {(r) => (
          <p class="mt-2 text-xs text-[var(--text-muted)]">
            {`Created ${r().connections.length} connection${r().connections.length === 1 ? '' : 's'}.`}
            {r().skipped > 0 ? ` (${r().skipped} already existed.)` : ''}
          </p>
        )}
      </Show>
    </div>
  )
}
