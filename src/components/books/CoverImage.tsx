import type { JSX } from '@solidjs/web'
import { createMemo, createSignal, Show } from 'solid-js'
import { getOpenLibraryCoverUrl, isLookupableIsbn, normalizeIsbn } from '../../lib/openLibrary'

type CoverBook = { cover_url: string | null; isbn?: string | null }

// Renders a book cover (or a placeholder icon) inside its own sized/rounded
// frame. When there's no explicit cover, falls back to the Open Library cover
// derived from the ISBN, and drops to the placeholder if that image fails.
export function CoverImage(props: {
  book: CoverBook
  class?: string
  iconClass?: string
  style?: JSX.CSSProperties
}) {
  const resolvedSrc = createMemo(() => {
    const cleanIsbn = props.book.isbn ? normalizeIsbn(props.book.isbn) : ''
    return (
      props.book.cover_url ||
      (isLookupableIsbn(cleanIsbn) ? getOpenLibraryCoverUrl(cleanIsbn) : null)
    )
  })

  // Tracks which src errored (not a plain boolean), so a src that has since
  // changed (cover fixed via edit) isn't stuck on the placeholder.
  const [failedSrc, setFailedSrc] = createSignal<string | null>(null)
  const failed = () => failedSrc() !== null && failedSrc() === resolvedSrc()

  return (
    <div class={`overflow-hidden ${props.class ?? ''}`} style={props.style}>
      <Show
        when={resolvedSrc() && !failed()}
        fallback={
          <div
            data-testid="cover-placeholder"
            class={`flex h-full w-full items-center justify-center opacity-40 ${props.iconClass ?? 'text-3xl'}`}
          >
            📖
          </div>
        }
      >
        <img
          data-testid="cover-image"
          src={resolvedSrc()!}
          alt=""
          loading="lazy"
          decoding="async"
          class="h-full w-full object-cover"
          onError={() => setFailedSrc(resolvedSrc())}
        />
      </Show>
    </div>
  )
}
