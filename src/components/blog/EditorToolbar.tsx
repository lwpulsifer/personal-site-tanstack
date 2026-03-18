import type { RefObject } from 'react'

// ── Divider ───────────────────────────────────────────────────────────────────

export const DIVIDER = <span className="w-px self-stretch bg-[var(--border)]" />

// ── ToolbarButton ─────────────────────────────────────────────────────────────

export function ToolbarButton({
  label,
  title,
  labelClass,
  onAction,
}: {
  label: string
  title: string
  labelClass?: string
  onAction: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      // mousedown keeps focus in the textarea; click fires after blur
      onMouseDown={(e) => {
        e.preventDefault()
        onAction()
      }}
      className="rounded px-2 py-1 text-xs text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
    >
      <span className={labelClass}>{label}</span>
    </button>
  )
}

// ── useEditorFormatting ───────────────────────────────────────────────────────

export function useEditorFormatting(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  setContent: (content: string) => void,
) {
  // Wraps the selected text (or a placeholder) in prefix/suffix.
  // After update, the inserted word is selected so the user can keep typing.
  function applyWrap(prefix: string, suffix: string, placeholder: string) {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const word = value.slice(s, e) || placeholder
    const next = value.slice(0, s) + prefix + word + suffix + value.slice(e)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + prefix.length, s + prefix.length + word.length)
    })
  }

  // Prepends prefix to the current line.
  function applyPrefix(prefix: string) {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + prefix.length, e + prefix.length)
    })
  }

  // Inserts a link, pre-selecting the url placeholder so the user can type it.
  function applyLink() {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const text = value.slice(s, e) || 'link text'
    const insertion = `[${text}](url)`
    const next = value.slice(0, s) + insertion + value.slice(e)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      // select the "url" placeholder: after `[text](`
      const urlStart = s + 1 + text.length + 2
      ta.setSelectionRange(urlStart, urlStart + 3)
    })
  }

  // Inserts an image tag, pre-selecting the url placeholder.
  function applyImage() {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const alt = value.slice(s, e) || 'alt text'
    const insertion = `![${alt}](url)`
    const next = value.slice(0, s) + insertion + value.slice(e)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      // select the "url" placeholder: after `![alt](`
      const urlStart = s + 2 + alt.length + 2
      ta.setSelectionRange(urlStart, urlStart + 3)
    })
  }

  return { applyWrap, applyPrefix, applyLink, applyImage }
}
