import { type RouteDefinition, useParams } from '@solidjs/router'
import { redirect } from '@solidjs/web'
import { createMemo, Show } from 'solid-js'
import { BookEditor, bookToEditorInitial } from '../../../components/books/BookEditor'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useViewTransitionNavigate } from '../../../lib/viewTransition'
import { paths } from '../../../router'
import { getServerUser } from '../../../server/auth'
import { getBook } from '../../../server/books'

// Editing is an admin-only action; the book itself is public, so a signed-out
// visitor who lands here (direct link, bookmark) is bounced back to the
// read-only page rather than 404'd. The real enforcement is server-side, in
// upsertBook/deleteBook's requireAuth() — this is just UX.
export const route = {
  preload: async ({ params }) => {
    if (!(await getServerUser())) throw redirect(String(paths.books(params.bookId ?? '')))
  },
} satisfies RouteDefinition

export default function EditBookPage() {
  const params = useParams()
  const navigateWithTransition = useViewTransitionNavigate()
  const bookId = () => params.bookId ?? ''
  const book = createMemo(() => getBook(bookId()))

  const backToBook = () => navigateWithTransition(String(paths.books(bookId())))

  return (
    <Show when={book()}>
      {(b) => (
        <ErrorBoundary>
          <BookEditor
            initial={bookToEditorInitial(b())}
            onClose={backToBook}
            onSaved={backToBook}
            onDeleted={() => navigateWithTransition(String(paths.books()))}
          />
        </ErrorBoundary>
      )}
    </Show>
  )
}
