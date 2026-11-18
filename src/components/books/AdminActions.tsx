import { createSignal, Show } from 'solid-js'
import { type BookStatus, type DbBook, deleteBook, setBookStatus } from '../../server/books'

// No entry for READ: it's an end state, so the only way back is via the
// editor rather than a one-click quick action.
const NEXT_STATUS: Partial<
  Record<BookStatus, { label: string; status: BookStatus; class: string }>
> = {
  WANT_TO_READ: {
    label: 'Start reading',
    status: 'READING',
    class: 'bg-[var(--blue-deep)] hover:bg-[var(--blue-darker)]',
  },
  READING: {
    label: 'Mark read',
    status: 'READ',
    class: 'bg-emerald-600 hover:bg-emerald-700',
  },
}

export function AdminActions(props: {
  book: DbBook
  onEdit: (book: DbBook) => void
  onDeleted?: () => void
}) {
  const [pending, setPending] = createSignal(false)
  const next = () => NEXT_STATUS[props.book.status]

  async function changeStatus(status: BookStatus) {
    setPending(true)
    try {
      await setBookStatus(props.book.id, status)
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    setPending(true)
    try {
      await deleteBook(props.book.id)
      props.onDeleted?.()
    } finally {
      setPending(false)
    }
  }

  return (
    <div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-[var(--border)] pt-3">
      <button
        type="button"
        data-testid="book-edit"
        onClick={() => props.onEdit(props.book)}
        class="rounded-full border border-[var(--blue-deep)] px-2.5 py-0.5 text-xs font-semibold text-[var(--blue-deep)] transition hover:bg-[var(--blue-deep)] hover:text-white"
      >
        Edit
      </button>

      <Show when={next()}>
        {(n) => (
          <button
            type="button"
            data-testid="book-next-status"
            onClick={() => changeStatus(n().status)}
            disabled={pending()}
            class={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white transition disabled:opacity-50 ${n().class}`}
          >
            {n().label}
          </button>
        )}
      </Show>

      <button
        type="button"
        data-testid="book-delete"
        onClick={() => {
          if (confirm(`Delete "${props.book.title}"? This can't be undone.`)) remove()
        }}
        disabled={pending()}
        class="rounded-full border border-red-400 px-2.5 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}
