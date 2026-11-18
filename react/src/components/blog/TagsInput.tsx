import { useRef, useState } from 'react'
import { useComboboxNav } from '#/lib/hooks/useComboboxNav'

export function TagsInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = suggestions.filter(
    (s) =>
      s.toLowerCase().startsWith(input.toLowerCase()) && !value.includes(s),
  )

  function addTag(raw: string) {
    const tag = raw.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput('')
    nav.setIsOpen(false)
    inputRef.current?.focus()
  }

  const nav = useComboboxNav({
    resultCount: filtered.length,
    onCommit: (index) => addTag(filtered[index]),
  })

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div ref={nav.containerRef} className="relative">
      <div className="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 transition focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[rgba(59,130,246,0.2)]">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--text)]"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="leading-none text-[var(--text-muted)] hover:text-[var(--text)]"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            nav.setIsOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === ',') {
              e.preventDefault()
              addTag(input)
            } else if (e.key === 'Enter' && nav.activeIndex < 0) {
              e.preventDefault()
              addTag(input)
            } else if (e.key === 'Backspace' && !input && value.length > 0) {
              onChange(value.slice(0, -1))
            } else {
              nav.handleKeyDown(e)
            }
          }}
          onFocus={() => nav.setIsOpen(true)}
          placeholder={value.length === 0 ? 'Add tags…' : ''}
          className="min-w-20 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
        />
      </div>

      {nav.isOpen && input && filtered.length > 0 && (
        <div
          id={nav.listboxId}
          role="listbox"
          aria-label="Suggested tags"
          className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg"
        >
          {filtered.slice(0, 8).map((tag, i) => (
            <div
              key={tag}
              role="option"
              tabIndex={-1}
              aria-selected={i === nav.activeIndex}
              onMouseDown={(e) => {
                e.preventDefault()
                addTag(tag)
              }}
              className={`cursor-pointer px-3 py-2 text-sm text-[var(--text)] ${
                i === nav.activeIndex
                  ? 'bg-[var(--hover-bg)]'
                  : 'hover:bg-[var(--hover-bg)]'
              }`}
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
