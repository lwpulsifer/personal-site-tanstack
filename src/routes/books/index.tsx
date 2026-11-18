import { Link, Meta, Title } from '@solidjs/meta'
import { createMemo, createSignal, Show } from 'solid-js'
import { BookEditor } from '../../components/books/BookEditor'
import { BookShelf } from '../../components/books/BookShelf'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { useAuth } from '../../lib/auth'
import { groupBooks } from '../../lib/books'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../../lib/site'
import { getBooks } from '../../server/books'

export default function BooksIndex() {
  const { isAuthenticated } = useAuth()
  const [isAddingBook, setIsAddingBook] = createSignal(false)
  const books = createMemo(() => getBooks())
  const groups = createMemo(() => groupBooks(books()))

  return (
    <>
      <Title>{`Books | ${SITE_TITLE}`}</Title>
      <Link rel="canonical" href={`${SITE_URL}/books`} />
      <Meta name="description" content={SITE_DESCRIPTION} />

      <Show when={isAddingBook()}>
        <ErrorBoundary>
          <BookEditor
            initial={{}}
            onClose={() => setIsAddingBook(false)}
            onSaved={() => setIsAddingBook(false)}
            onDeleted={() => setIsAddingBook(false)}
          />
        </ErrorBoundary>
      </Show>

      <main class="page-wrap px-4 pb-8 pt-14">
        <section class="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="island-kicker mb-2">Reading Log</p>
            <h1
              data-testid="books-heading"
              class="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl"
            >
              Books
            </h1>
          </div>

          <Show when={isAuthenticated()}>
            <button
              type="button"
              data-testid="new-book-btn"
              onClick={() => setIsAddingBook(true)}
              class="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
            >
              + Add Book
            </button>
          </Show>
        </section>

        <Show
          when={books().length > 0}
          fallback={<p class="text-[var(--text-muted)]">No books logged yet.</p>}
        >
          <BookShelf label="Reading" shelfKey="reading" books={groups().reading} defaultOpen />
          <BookShelf label="Read" shelfKey="read" books={groups().read} defaultOpen maxVisible={10} />
          <BookShelf
            label="Want to Read"
            shelfKey="want_to_read"
            books={groups().wantToRead}
            defaultOpen={false}
          />
        </Show>
      </main>
    </>
  )
}
