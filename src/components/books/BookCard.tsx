import { CoverImage } from '#/components/books/CoverImage'
import { StarRating } from '#/components/books/StarRating'
import type { DbBook } from '#/server/books'

type BookCardProps = {
  book: DbBook
  onView: (book: DbBook) => void
  className?: string
  style?: React.CSSProperties
}

// A compact "book cover" tile: image, title, author, rating — nothing else.
// Everything else (status, dates, review, admin actions) lives behind the
// click, in BookDetail.
export function BookCard({
  book,
  onView,
  className = '',
  style,
}: BookCardProps) {
  return (
    <button
      type="button"
      data-testid={`book-card-${book.id}`}
      onClick={() => onView(book)}
      className={`group flex flex-col text-left transition hover:-translate-y-1 ${className}`}
      style={style}
    >
      <CoverImage
        book={book}
        className="aspect-[2/3] w-full rounded-lg bg-[var(--chip-bg)] shadow-md transition group-hover:shadow-xl"
      />

      <h2
        data-testid={`book-title-${book.id}`}
        className="m-0 mt-2 line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]"
      >
        {book.title}
      </h2>
      <p className="m-0 line-clamp-1 text-xs text-[var(--text-muted)]">
        {book.author}
      </p>
      <div className="mt-1">
        <StarRating rating={book.rating} />
      </div>
    </button>
  )
}
