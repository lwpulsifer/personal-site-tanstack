import type { BookStatus, DbBook } from '#/server/books'
import { StarRating } from '#/components/books/StarRating'
import { AdminActions } from '#/components/books/AdminActions'

const STATUS_LABEL: Record<BookStatus, string> = {
  WANT_TO_READ: 'Want to Read',
  READING: 'Reading',
  READ: 'Read',
}

const STATUS_STYLES: Record<BookStatus, string> = {
  READING: 'bg-[var(--blue-deep)]/10 text-[var(--blue-deep)] dark:text-blue-300',
  READ: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  WANT_TO_READ: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function bookDate(book: DbBook) {
  const iso = book.finished_at ?? book.started_at ?? book.created_at
  const label =
    book.status === 'READ' && book.finished_at
      ? 'Finished'
      : book.status === 'READING' && book.started_at
        ? 'Started'
        : 'Added'
  const date = new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `${label} ${date}`
}

type BookCardProps = {
  book: DbBook
  showAdmin: boolean
  onEdit: (book: DbBook) => void
  className?: string
  style?: React.CSSProperties
}

export function BookCard({ book, showAdmin, onEdit, className = '', style }: BookCardProps) {
  return (
    <article
      data-testid={`book-card-${book.id}`}
      className={`island-shell flex gap-4 rounded-2xl p-4 ${className}`}
      style={style}
    >
      <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--chip-bg)]">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-[var(--text-muted)] opacity-40">
            📖
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[book.status]}`}>
            {STATUS_LABEL[book.status]}
          </span>
          <StarRating rating={book.rating} />
        </div>

        <h2
          data-testid={`book-title-${book.id}`}
          className="m-0 text-lg font-semibold leading-snug text-[var(--text)]"
        >
          {book.title}
        </h2>
        <p className="m-0 text-sm text-[var(--text-muted)]">{book.author}</p>

        {book.review && (
          <p className="mt-2 line-clamp-3 text-sm text-[var(--text-muted)]">{book.review}</p>
        )}

        <p className="m-0 mt-2 text-xs text-[var(--text-muted)]">{bookDate(book)}</p>

        {showAdmin && <AdminActions book={book} onEdit={onEdit} />}
      </div>
    </article>
  )
}
