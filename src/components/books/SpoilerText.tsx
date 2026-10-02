import { Fragment, useState } from 'react'

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
    if (index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, index) })
    }
    segments.push({ type: 'spoiler', content: match[1] })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }
  return segments
}

// Plain-text version with spoiler content redacted, for contexts that can't
// gate a reveal click — e.g. the page's <meta description>, which would
// otherwise leak spoilers straight into link previews and search results.
export function redactSpoilers(text: string): string {
  return parseSpoilerSegments(text)
    .map((segment) =>
      segment.type === 'spoiler' ? '[spoiler]' : segment.content,
    )
    .join('')
}

function Spoiler({ children }: { children: string }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <button
      type="button"
      data-testid="spoiler"
      aria-pressed={revealed}
      onClick={() => setRevealed(true)}
      className={`-my-0.5 rounded px-1 font-sans transition-colors duration-300 ${
        revealed
          ? 'cursor-text bg-transparent text-[var(--text)]'
          : 'cursor-pointer bg-[var(--text)] text-transparent hover:opacity-80'
      }`}
    >
      {children}
    </button>
  )
}

// Renders review text with ||spoiler|| spans swapped for click-to-reveal
// highlighter blocks. Plain segments render as-is (no markdown).
export function ReviewText({ text }: { text: string }) {
  const segments = parseSpoilerSegments(text)
  return (
    <>
      {segments.map((segment, i) =>
        segment.type === 'spoiler' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are a pure, whole-text parse — not individually edited or reordered
          <Spoiler key={i}>{segment.content}</Spoiler>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are a pure, whole-text parse — not individually edited or reordered
          <Fragment key={i}>{segment.content}</Fragment>
        ),
      )}
    </>
  )
}
