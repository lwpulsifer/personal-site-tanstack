export const DIVIDER = () => <span class="w-px self-stretch bg-[var(--border)]" />

export function ToolbarButton(props: {
  label: string
  title: string
  labelClass?: string
  onAction: () => void
}) {
  return (
    <button
      type="button"
      title={props.title}
      // mousedown keeps focus in the textarea; click fires after blur
      onMouseDown={(e) => {
        e.preventDefault()
        props.onAction()
      }}
      class="rounded px-2 py-1 text-xs text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
    >
      <span class={props.labelClass}>{props.label}</span>
    </button>
  )
}

// Markdown-formatting helpers over a textarea. `getTextarea` is a function
// (not a ref object) since Solid refs are plain assigned variables.
export function createEditorFormatting(
  getTextarea: () => HTMLTextAreaElement | undefined,
  setContent: (content: string) => void,
) {
  function edit(
    build: (sel: { s: number; e: number; value: string }) => { next: string; select: [number, number] },
  ) {
    const ta = getTextarea()
    if (!ta) return
    const { next, select } = build({ s: ta.selectionStart, e: ta.selectionEnd, value: ta.value })
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(select[0], select[1])
    })
  }

  // Wraps the selected text (or a placeholder) in prefix/suffix.
  const applyWrap = (prefix: string, suffix: string, placeholder: string) =>
    edit(({ s, e, value }) => {
      const word = value.slice(s, e) || placeholder
      return {
        next: value.slice(0, s) + prefix + word + suffix + value.slice(e),
        select: [s + prefix.length, s + prefix.length + word.length],
      }
    })

  // Prepends prefix to the current line.
  const applyPrefix = (prefix: string) =>
    edit(({ s, e, value }) => {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      return {
        next: value.slice(0, lineStart) + prefix + value.slice(lineStart),
        select: [s + prefix.length, e + prefix.length],
      }
    })

  // Inserts `[text](url)` / `![alt](url)` with the url placeholder selected.
  const applyLink = () =>
    edit(({ s, e, value }) => {
      const text = value.slice(s, e) || 'link text'
      const urlStart = s + 1 + text.length + 2
      return {
        next: `${value.slice(0, s)}[${text}](url)${value.slice(e)}`,
        select: [urlStart, urlStart + 3],
      }
    })
  const applyImage = () =>
    edit(({ s, e, value }) => {
      const alt = value.slice(s, e) || 'alt text'
      const urlStart = s + 2 + alt.length + 2
      return {
        next: `${value.slice(0, s)}![${alt}](url)${value.slice(e)}`,
        select: [urlStart, urlStart + 3],
      }
    })

  return { applyWrap, applyPrefix, applyLink, applyImage }
}
