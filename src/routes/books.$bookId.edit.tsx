import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { BookEditor, bookToEditorInitial } from '#/components/books/BookEditor'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { bookQueryOptions, booksQueryOptions } from '#/lib/queries'
import { getServerUser } from '#/server/auth'
import { getBook } from '#/server/books'

export const Route = createFileRoute('/books/$bookId/edit')({
  // Editing is an admin-only action; the book itself is public, so a
  // signed-out visitor who lands here (direct link, bookmark) is bounced
  // back to the read-only page rather than 404'd. The real enforcement is
  // server-side, in upsertBook/deleteBook's requireAuth() — this is just UX.
  beforeLoad: async ({ params }) => {
    const user = await getServerUser()
    if (!user) {
      throw redirect({
        to: '/books/$bookId',
        params: { bookId: params.bookId },
      })
    }
  },
  loader: async ({ params }) => {
    const book = await getBook({ data: { bookId: params.bookId } })
    if (!book) throw notFound()
    return book
  },
  component: EditBookPage,
})

function EditBookPage() {
  const initialBook = Route.useLoaderData()
  // Same queryKey as the parent /books/$bookId route, so this reads the
  // already-warm cache (populated by the parent) instead of refetching.
  const { data: book } = useQuery({
    ...bookQueryOptions(initialBook.id),
    initialData: initialBook,
  })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Guards a race (deleted from another tab mid-navigation) rather than a
  // real steady state — initialData means this is non-null on first render.
  if (!book) return null

  const bookId = book.id

  function backToBook() {
    navigate({
      to: '/books/$bookId',
      params: { bookId },
      viewTransition: true,
    })
  }

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: bookQueryOptions(bookId).queryKey,
    })
    queryClient.invalidateQueries({ queryKey: booksQueryOptions.queryKey })
  }

  return (
    <ErrorBoundary>
      <BookEditor
        initial={bookToEditorInitial(book)}
        onClose={backToBook}
        onSaved={() => {
          invalidate()
          backToBook()
        }}
        onDeleted={() => navigate({ to: '/books', viewTransition: true })}
      />
    </ErrorBoundary>
  )
}
