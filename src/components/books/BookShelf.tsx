import { useState } from 'react'
import { BookCard } from '#/components/books/BookCard'
import { CoverImage } from '#/components/books/CoverImage'
import type { DbBook } from '#/server/books'

const GRID_CLASSES =
  'grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'

// Degrees each successive cover fans out from center, so a 3-cover stack
// spreads -7/0/+7 degrees and looks like a loosely spread pile of books.
const FAN_ROTATE_STEP_DEG = 7
const MAX_STACKED_COVERS = 3

function StackedCovers({ books }: { books: DbBook[] }) {
  const covers = books.slice(0, MAX_STACKED_COVERS)
  return (
    <div className="relative h-20 w-14 flex-shrink-0">
      {covers.map((book, i) => (
        <div
          key={book.id}
          className="absolute inset-0"
          style={{
            transform: `rotate(${(i - (covers.length - 1) / 2) * FAN_ROTATE_STEP_DEG}deg) translateX(${i * 3}px)`,
            zIndex: i,
          }}
        >
          <CoverImage
            book={book}
            iconClassName="text-lg"
            className="h-full w-full rounded-md bg-[var(--chip-bg)] shadow-md ring-1 ring-black/10"
          />
        </div>
      ))}
    </div>
  )
}

type BookShelfProps = {
  label: string
  shelfKey: string
  books: DbBook[]
  defaultOpen: boolean
  onView: (book: DbBook) => void
  // Caps how many cards render initially when the shelf is expanded, with a
  // "Show more" button to reveal the rest. Unlimited if omitted.
  maxVisible?: number
}

// A collapsible "shelf" of books. Collapsed, it renders as a stack of
// fanned covers you can click to expand into a full-width grid.
export function BookShelf({
  label,
  shelfKey,
  books,
  defaultOpen,
  onView,
  maxVisible,
}: BookShelfProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [showAll, setShowAll] = useState(false)

  if (books.length === 0) return null

  const isTruncated = !!maxVisible && !showAll && books.length > maxVisible
  const visibleBooks = isTruncated ? books.slice(0, maxVisible) : books

  return (
    <section className="mb-10">
      <button
        type="button"
        data-testid={`shelf-toggle-${shelfKey}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="mb-3 flex items-center gap-2"
      >
        <span className="island-kicker">{label}</span>
        <span className="text-xs text-[var(--text-muted)]">
          ({books.length})
        </span>
        <span
          aria-hidden="true"
          className={`text-xs text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-90' : ''}`}
        >
          ›
        </span>
      </button>

      {isOpen ? (
        <>
          <div data-testid={`shelf-books-${shelfKey}`} className={GRID_CLASSES}>
            {visibleBooks.map((book, i) => (
              <BookCard
                key={book.id}
                book={book}
                onView={onView}
                className="rise-in"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>

          {isTruncated && (
            <button
              type="button"
              data-testid={`shelf-show-more-${shelfKey}`}
              onClick={() => setShowAll(true)}
              className="mt-4 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              Show {books.length - maxVisible} more →
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          data-testid={`shelf-stack-${shelfKey}`}
          onClick={() => setIsOpen(true)}
          className="flex items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--chip-bg)] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <StackedCovers books={books} />
          <span className="pb-1 text-sm text-[var(--text-muted)]">
            {books.length} book{books.length === 1 ? '' : 's'} — tap to expand
          </span>
        </button>
      )}
    </section>
  )
}
