import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import { useState } from 'react'
import { AdminActions } from '#/components/books/AdminActions'
import { BookEditor, bookToEditorInitial } from '#/components/books/BookEditor'
import { STATUS_LABEL, STATUS_STYLES } from '#/components/books/bookStatus'
import { CoverImage } from '#/components/books/CoverImage'
import { StarRating } from '#/components/books/StarRating'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { useAuth } from '#/lib/auth'
import {
  getOpenLibraryCoverUrl,
  isLookupableIsbn,
  normalizeIsbn,
} from '#/lib/openLibrary'
import { bookQueryOptions, booksQueryOptions } from '#/lib/queries'
import { SITE_TITLE, SITE_URL } from '#/lib/site'
import { type DbBook, getBook } from '#/server/books'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// Same cover-resolution logic as CoverImage, but returning a plain URL for
// use in og:image rather than rendering a component.
function resolveCoverUrl(
  book: Pick<DbBook, 'cover_url' | 'isbn'>,
): string | null {
  if (book.cover_url) return book.cover_url
  const cleanIsbn = book.isbn ? normalizeIsbn(book.isbn) : ''
  return isLookupableIsbn(cleanIsbn) ? getOpenLibraryCoverUrl(cleanIsbn) : null
}

export const Route = createFileRoute('/books/$bookId')({
  loader: async ({ params }) => {
    const book = await getBook({ data: { bookId: params.bookId } })
    if (!book) throw notFound()
    return book
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {}
    const book = loaderData
    const description = book.review
      ? book.review.slice(0, 200)
      : `${book.title} by ${book.author}, on Liam's reading list.`
    const image = resolveCoverUrl(book)
    return {
      links: [{ rel: 'canonical', href: `${SITE_URL}/books/${params.bookId}` }],
      meta: [
        { title: `${book.title} by ${book.author} — ${SITE_TITLE}` },
        { name: 'description', content: description },
        ...(image ? [{ property: 'og:image', content: image }] : []),
      ],
    }
  },
  component: BookPage,
})

function BookPage() {
  const initialBook = Route.useLoaderData()
  const { data: book } = useQuery({
    ...bookQueryOptions(initialBook.id),
    initialData: initialBook,
  })
  const { isAuthenticated } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // The book can disappear out from under this page (deleted from another
  // tab/session while someone's viewing it) — the query then resolves to
  // null on its next refetch, rather than ever being undefined.
  if (!book) {
    return (
      <main className="page-wrap flex justify-center px-4 pb-12 pt-16">
        <p className="text-[var(--text-muted)]">This book has been removed.</p>
      </main>
    )
  }

  const bookId = book.id

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: bookQueryOptions(bookId).queryKey,
    })
    queryClient.invalidateQueries({ queryKey: booksQueryOptions.queryKey })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/books/${bookId}`)
      setCopyStatus('copied')
    } catch {
      // Clipboard access can be denied by the browser; the URL is still
      // visible in the address bar, so this is a nice-to-have, not worth
      // surfacing as an error.
    }
  }

  return (
    <>
      {isEditing && (
        <ErrorBoundary>
          <BookEditor
            initial={bookToEditorInitial(book)}
            onClose={() => setIsEditing(false)}
            onSaved={() => {
              invalidate()
              setIsEditing(false)
            }}
            onDeleted={() => navigate({ to: '/books' })}
          />
        </ErrorBoundary>
      )}

      <main className="page-wrap flex justify-center px-4 pb-12 pt-16">
        <article
          data-testid="book-page"
          className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between border-b border-[var(--border)] pb-4">
            <Link
              to="/books"
              viewTransition
              data-testid="book-back-link"
              className="text-sm font-semibold text-[var(--blue-deep)] no-underline hover:underline"
            >
              ← Back to all books
            </Link>

            <button
              type="button"
              onClick={copyLink}
              data-testid="book-copy-link-btn"
              aria-label={
                copyStatus === 'copied' ? 'Link copied' : 'Copy link to share'
              }
              title={
                copyStatus === 'copied' ? 'Link copied!' : 'Copy link to share'
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
            >
              {copyStatus === 'copied' ? '✓' : '🔗'}
            </button>
          </div>

          <div className="flex gap-5">
            <CoverImage
              book={book}
              style={{ viewTransitionName: `book-cover-${book.id}` }}
              className="h-56 w-36 flex-shrink-0 rounded-lg bg-[var(--chip-bg)] shadow-md sm:h-64 sm:w-44"
            />

            <div className="min-w-0">
              <span
                className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[book.status]}`}
              >
                {STATUS_LABEL[book.status]}
              </span>
              <h1
                data-testid="book-page-title"
                className="display-title m-0 text-2xl font-bold leading-snug text-[var(--text)] sm:text-3xl"
              >
                {book.title}
              </h1>
              <p className="m-0 mt-1 text-sm text-[var(--text-muted)]">
                {book.author}
              </p>
              {book.rating != null && (
                <div className="mt-2">
                  <StarRating rating={book.rating} />
                </div>
              )}
            </div>
          </div>

          <dl className="mb-4 mt-6 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)] sm:w-64">
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
            <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">
              Review
            </p>
            {book.review ? (
              <p
                data-testid="book-page-review"
                className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]"
              >
                {book.review}
              </p>
            ) : (
              <p className="text-sm italic text-[var(--text-muted)]">
                No review yet.
              </p>
            )}
          </div>

          {isAuthenticated && (
            <AdminActions
              book={book}
              onEdit={() => setIsEditing(true)}
              onDeleted={() => navigate({ to: '/books' })}
            />
          )}
        </article>
      </main>
    </>
  )
}
