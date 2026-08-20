import { useState } from 'react'
import {
  getOpenLibraryCoverUrl,
  isLookupableIsbn,
  normalizeIsbn,
} from '#/lib/openLibrary'

// Fills its parent's sized/rounded wrapper with either the cover image or a
// placeholder icon. Used by BookCard, BookDetail, and BookShelf's stack.
//
// When there's no explicit cover image, falls back to the Open Library cover
// derived from the book's ISBN, and drops to the placeholder icon if that
// image fails to load (e.g. no cover on file for that ISBN).
export function CoverImage({
  src,
  isbn,
  iconClassName = 'text-3xl',
}: {
  src: string | null
  isbn?: string | null
  iconClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  const cleanIsbn = isbn ? normalizeIsbn(isbn) : ''
  const resolvedSrc =
    src ||
    (isLookupableIsbn(cleanIsbn) ? getOpenLibraryCoverUrl(cleanIsbn) : null)

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center opacity-40 ${iconClassName}`}
      >
        📖
      </div>
    )
  }
  return (
    <img
      src={resolvedSrc}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}
