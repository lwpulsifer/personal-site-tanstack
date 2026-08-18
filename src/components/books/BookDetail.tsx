import type { DbBook } from '#/server/books'
import { StarRating } from '#/components/books/StarRating'
import { AdminActions } from '#/components/books/AdminActions'
import { STATUS_LABEL, STATUS_STYLES } from '#/components/books/bookStatus'
import { CoverImage } from '#/components/books/CoverImage'
import { useOnEscapeKey } from '#/lib/hooks/useOnEscapeKey'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

type BookDetailProps = {
  book: DbBook
  showAdmin: boolean
  onClose: () => void
  onEdit: (book: DbBook) => void
}

export function BookDetail({ book, showAdmin, onClose, onEdit }: BookDetailProps) {
  useOnEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 backdrop-blur-sm sm:pt-16">
      <div
        data-testid="book-detail"
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex gap-4">
            <div className="h-36 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--chip-bg)]">
              <CoverImage src={book.cover_url} />
            </div>

            <div className="min-w-0">
              <span
                className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[book.status]}`}
              >
                {STATUS_LABEL[book.status]}
              </span>
              <h2
                data-testid="book-detail-title"
                className="m-0 text-xl font-semibold leading-snug text-[var(--text)]"
              >
                {book.title}
              </h2>
              <p className="m-0 text-sm text-[var(--text-muted)]">{book.author}</p>
              {book.rating != null && <StarRating rating={book.rating} />}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-book-detail"
            aria-label="Close"
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
          {book.started_at && (
            <div>
              <dt className="font-semibold text-[var(--text)]">Started</dt>
              <dd className="m-0">{formatDate(book.started_at)}</dd>
            </div>
          )}
          {book.finished_at && (
            <div>
              <dt className="font-semibold text-[var(--text)]">Finished</dt>
              <dd className="m-0">{formatDate(book.finished_at)}</dd>
            </div>
          )}
        </dl>

        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">Review</p>
          {book.review ? (
            <p
              data-testid="book-detail-review"
              className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]"
            >
              {book.review}
            </p>
          ) : (
            <p className="text-sm italic text-[var(--text-muted)]">No review yet.</p>
          )}
        </div>

        {showAdmin && <AdminActions book={book} onEdit={onEdit} onDeleted={onClose} />}
      </div>
    </div>
  )
}
