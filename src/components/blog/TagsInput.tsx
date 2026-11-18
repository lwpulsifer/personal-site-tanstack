import { createMemo, createSignal, For, Show } from 'solid-js'
import { createComboboxNav } from '../../lib/hooks/createComboboxNav'

export function TagsInput(props: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
}) {
  const [input, setInput] = createSignal('')
  let inputEl!: HTMLInputElement

  const filtered = createMemo(() =>
    props.suggestions.filter(
      (s) => s.toLowerCase().startsWith(input().toLowerCase()) && !props.value.includes(s),
    ),
  )

  function addTag(raw: string) {
    const tag = raw.trim()
    if (tag && !props.value.includes(tag)) props.onChange([...props.value, tag])
    setInput('')
    nav.setIsOpen(false)
    inputEl.focus()
  }

  const nav = createComboboxNav({
    resultCount: () => filtered().length,
    onCommit: (index) => addTag(filtered()[index]),
  })

  return (
    <div ref={nav.setContainer} class="relative">
      <div class="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 transition focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[rgba(59,130,246,0.2)]">
        <For each={props.value}>
          {(tag) => (
            <span class="inline-flex items-center gap-1 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--text)]">
              {tag}
              <button
                type="button"
                onClick={() => props.onChange(props.value.filter((t) => t !== tag))}
                class="leading-none text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          )}
        </For>
        <input
          ref={inputEl}
          type="text"
          value={input()}
          onInput={(e) => {
            setInput(e.currentTarget.value)
            nav.setIsOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === ',') {
              e.preventDefault()
              addTag(input())
            } else if (e.key === 'Enter' && nav.activeIndex() < 0) {
              e.preventDefault()
              addTag(input())
            } else if (e.key === 'Backspace' && !input() && props.value.length > 0) {
              props.onChange(props.value.slice(0, -1))
            } else {
              nav.handleKeyDown(e)
            }
          }}
          onFocus={() => nav.setIsOpen(true)}
          placeholder={props.value.length === 0 ? 'Add tags…' : ''}
          class="min-w-20 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
        />
      </div>

      <Show when={nav.isOpen() && input() && filtered().length > 0}>
        <div
          id={nav.listboxId}
          role="listbox"
          aria-label="Suggested tags"
          class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg"
        >
          <For each={filtered().slice(0, 8)}>
            {(tag, i) => (
              <div
                role="option"
                tabindex={-1}
                aria-selected={i() === nav.activeIndex() ? 'true' : 'false'}
                onMouseDown={(e) => {
                  e.preventDefault()
                  addTag(tag)
                }}
                class={`cursor-pointer px-3 py-2 text-sm text-[var(--text)] ${
                  i() === nav.activeIndex() ? 'bg-[var(--hover-bg)]' : 'hover:bg-[var(--hover-bg)]'
                }`}
              >
                {tag}
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
