import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteBook, setBookStatus, type BookStatus, type DbBook } from '#/server/books'
import { booksQueryOptions } from '#/lib/queries'

// No entry for READ: it's an end state, so the only way back is via the
// editor rather than a one-click quick action.
const NEXT_STATUS: Partial<Record<BookStatus, { label: string; status: BookStatus; className: string }>> = {
  WANT_TO_READ: {
    label: 'Start reading',
    status: 'READING',
    className: 'bg-[var(--blue-deep)] hover:bg-[var(--blue-darker)]',
  },
  READING: {
    label: 'Mark read',
    status: 'READ',
    className: 'bg-emerald-600 hover:bg-emerald-700',
  },
}

export function AdminActions({
  book,
  onEdit,
  onDeleted,
}: {
  book: DbBook
  onEdit: (book: DbBook) => void
  onDeleted?: () => void
}) {
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: (status: BookStatus) => setBookStatus({ data: { bookId: book.id, status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: booksQueryOptions.queryKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBook({ data: { bookId: book.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: booksQueryOptions.queryKey })
      onDeleted?.()
    },
  })

  const isPending = statusMutation.isPending || deleteMutation.isPending
  const next = NEXT_STATUS[book.status]

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-[var(--border)] pt-3">
      <button
        type="button"
        data-testid="book-edit"
        onClick={() => onEdit(book)}
        className="rounded-full border border-[var(--blue-deep)] px-2.5 py-0.5 text-xs font-semibold text-[var(--blue-deep)] transition hover:bg-[var(--blue-deep)] hover:text-white"
      >
        Edit
      </button>

      {next && (
        <button
          type="button"
          data-testid="book-next-status"
          onClick={() => statusMutation.mutate(next.status)}
          disabled={isPending}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white transition disabled:opacity-50 ${next.className}`}
        >
          {next.label}
        </button>
      )}

      <button
        type="button"
        data-testid="book-delete"
        onClick={() => {
          if (confirm(`Delete "${book.title}"? This can't be undone.`)) {
            deleteMutation.mutate()
          }
        }}
        disabled={isPending}
        className="rounded-full border border-red-400 px-2.5 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}
