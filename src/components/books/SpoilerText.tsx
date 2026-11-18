import { createSignal, For, Show } from 'solid-js'

// Reddit/Discord-style spoiler markup: ||hidden text|| becomes a solid,
// click-to-reveal highlighter block. Parsed with a simple non-greedy regex
// rather than a full markdown pass, since book reviews are plain text.
const SPOILER_PATTERN = /\|\|([\s\S]+?)\|\|/g

type Segment = { type: 'text' | 'spoiler'; content: string }

export function parseSpoilerSegments(text: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  for (const match of text.matchAll(SPOILER_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) segments.push({ type: 'text', content: text.slice(lastIndex, index) })
    segments.push({ type: 'spoiler', content: match[1] })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex) })
  return segments
}

// Plain-text version with spoilers redacted, for contexts that can't gate a
// reveal click — e.g. the <meta description>, which would otherwise leak
// spoilers into link previews and search results.
export function redactSpoilers(text: string): string {
  return parseSpoilerSegments(text)
    .map((s) => (s.type === 'spoiler' ? '[spoiler]' : s.content))
    .join('')
}

function Spoiler(props: { children: string }) {
  const [revealed, setRevealed] = createSignal(false)
  const reveal = () => setRevealed(true)

  // A <span role="button"> rather than a real <button>: browsers force form
  // controls to "blockify" even under `display: inline`, which would break the
  // spoiler onto its own line. Keyboard activation covers what the semantic
  // element would have given for free.
  return (
    <span
      role="button"
      tabindex={0}
      data-testid="spoiler"
      aria-pressed={revealed() ? 'true' : 'false'}
      onClick={reveal}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          reveal()
        }
      }}
      class={`rounded-sm transition-colors duration-300 ${
        revealed()
          ? 'cursor-text bg-transparent text-[var(--text)]'
          : 'cursor-pointer bg-[var(--text)] text-transparent hover:opacity-80'
      }`}
    >
      {props.children}
    </span>
  )
}

// Renders review text with ||spoiler|| spans swapped for click-to-reveal blocks.
export function ReviewText(props: { text: string }) {
  return (
    <For each={parseSpoilerSegments(props.text)} keyed={false}>
      {(segment) => (
        <Show when={segment().type === 'spoiler'} fallback={segment().content}>
          <Spoiler>{segment().content}</Spoiler>
        </Show>
      )}
    </For>
  )
}
