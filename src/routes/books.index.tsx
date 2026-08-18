import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '#/lib/auth'
import { booksQueryOptions } from '#/lib/queries'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '#/lib/site'
import { getBooks, type DbBook } from '#/server/books'
import { BookCard } from '#/components/books/BookCard'
import { BookEditor, type BookEditorInitial } from '#/components/books/BookEditor'
import { ErrorBoundary } from '#/components/ErrorBoundary'

const canonical = `${SITE_URL}/books`
const pageTitle = `Books | ${SITE_TITLE}`

export const Route = createFileRoute('/books/')({
  loader: async () => getBooks(),
  head: () => ({
    links: [{ rel: 'canonical', href: canonical }],
    meta: [
      { title: pageTitle },
      { name: 'description', content: SITE_DESCRIPTION },
    ],
  }),
  component: BooksIndex,
})

function byDateDesc(dateA: string | null, dateB: string | null) {
  return new Date(dateB ?? 0).valueOf() - new Date(dateA ?? 0).valueOf()
}

// Reading books lead the main list regardless of date, followed by finished
// books sorted by when they were finished. Want-to-read books have no
// meaningful chronological signal, so they get their own list below.
function groupBooks(books: DbBook[]) {
  const reading = books
    .filter((b) => b.status === 'READING')
    .sort((a, b) => byDateDesc(a.started_at, b.started_at))
  const read = books
    .filter((b) => b.status === 'READ')
    .sort((a, b) => byDateDesc(a.finished_at, b.finished_at))
  const wantToRead = books
    .filter((b) => b.status === 'WANT_TO_READ')
    .sort((a, b) => byDateDesc(a.created_at, b.created_at))
  return { primary: [...reading, ...read], wantToRead }
}

function toEditorInitial(book: DbBook): BookEditorInitial {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn ?? '',
    cover_url: book.cover_url ?? '',
    status: book.status,
    rating: book.rating,
    review: book.review ?? '',
    started_at: book.started_at,
    finished_at: book.finished_at,
  }
}

function BooksIndex() {
  const loaderBooks = Route.useLoaderData()
  const { data: books = loaderBooks } = useQuery(booksQueryOptions)
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [editingBook, setEditingBook] = useState<DbBook | 'new' | null>(null)
  const { primary, wantToRead } = useMemo(() => groupBooks(books), [books])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: booksQueryOptions.queryKey })
  }

  return (
    <>
      {editingBook && (
        <ErrorBoundary>
          <BookEditor
            initial={editingBook === 'new' ? {} : toEditorInitial(editingBook)}
            onClose={() => setEditingBook(null)}
            onSaved={() => {
              invalidate()
              setEditingBook(null)
            }}
            onDeleted={() => {
              invalidate()
              setEditingBook(null)
            }}
          />
        </ErrorBoundary>
      )}

      <main className="page-wrap px-4 pb-8 pt-14">
        <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="island-kicker mb-2">Reading Log</p>
            <h1
              data-testid="books-heading"
              className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl"
            >
              Books
            </h1>
          </div>

          {isAuthenticated && (
            <button
              type="button"
              data-testid="new-book-btn"
              onClick={() => setEditingBook('new')}
              className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
            >
              + Add Book
            </button>
          )}
        </section>

        {books.length === 0 ? (
          <p className="text-[var(--text-muted)]">No books logged yet.</p>
        ) : (
          <>
            {primary.length > 0 && (
              <section data-testid="primary-books" className="grid gap-4 sm:grid-cols-2">
                {primary.map((book, i) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    showAdmin={isAuthenticated}
                    onEdit={setEditingBook}
                    className="rise-in"
                    style={{ animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </section>
            )}

            {wantToRead.length > 0 && (
              <section className="mt-10">
                <p data-testid="want-to-read-heading" className="island-kicker mb-3">
                  Want to Read
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {wantToRead.map((book, i) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      showAdmin={isAuthenticated}
                      onEdit={setEditingBook}
                      className="rise-in"
                      style={{ animationDelay: `${i * 60}ms` }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}
