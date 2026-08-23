import { useState } from 'react'
import {
  getOpenLibraryCoverUrl,
  isLookupableIsbn,
  normalizeIsbn,
} from '#/lib/openLibrary'

type CoverBook = {
  cover_url: string | null
  isbn?: string | null
}

// Renders a book cover (or a placeholder icon) inside its own sized/rounded
// frame. Used by BookCard, BookDetail, BookEditor's preview, and BookShelf's
// stack. `className` sizes and shapes the frame (e.g. `aspect-[2/3] w-full
// rounded-lg`) — overflow-hidden is baked in so covers never poke out.
//
// When there's no explicit cover image, falls back to the Open Library cover
// derived from the book's ISBN, and drops to the placeholder icon if that
// image fails to load (e.g. no cover on file for that ISBN).
export function CoverImage({
  book,
  className = '',
  iconClassName = 'text-3xl',
}: {
  book: CoverBook
  className?: string
  iconClassName?: string
}) {
  const cleanIsbn = book.isbn ? normalizeIsbn(book.isbn) : ''
  const resolvedSrc =
    book.cover_url ||
    (isLookupableIsbn(cleanIsbn) ? getOpenLibraryCoverUrl(cleanIsbn) : null)

  // Tracks which src errored, rather than a plain boolean, so a src that's
  // since changed (e.g. the cover was fixed via an edit) isn't stuck
  // showing the placeholder from a previous, unrelated failure.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = failedSrc !== null && failedSrc === resolvedSrc

  return (
    <div className={`overflow-hidden ${className}`}>
      {!resolvedSrc || failed ? (
        <div
          data-testid="cover-placeholder"
          className={`flex h-full w-full items-center justify-center opacity-40 ${iconClassName}`}
        >
          📖
        </div>
      ) : (
        <img
          data-testid="cover-image"
          src={resolvedSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(resolvedSrc)}
        />
      )}
    </div>
  )
}
