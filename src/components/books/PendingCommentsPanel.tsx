import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { pendingCommentsQueryOptions } from '#/lib/queries'
import { approveComment, rejectComment } from '#/server/comments'

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

export function PendingCommentsPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { data: pending } = useQuery(pendingCommentsQueryOptions)

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['bookComments'] })
  }

  return (
    <div
      ref={panelRef}
      data-testid="pending-comments-panel"
      className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl"
    >
      <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
        Comments awaiting approval
      </p>

      {!pending || pending.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nothing pending.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {pending.map((comment) => (
            <PendingCommentRow
              key={comment.id}
              comment={comment}
              onModerated={invalidate}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function PendingCommentRow({
  comment,
  onModerated,
}: {
  comment: {
    id: string
    author_name: string
    body: string
    book: { id: string; title: string }
  }
  onModerated: () => void
}) {
  const approveMutation = useMutation({
    mutationFn: () => approveComment({ data: { commentId: comment.id } }),
    onSuccess: onModerated,
  })
  const rejectMutation = useMutation({
    mutationFn: () => rejectComment({ data: { commentId: comment.id } }),
    onSuccess: onModerated,
  })
  const isBusy = approveMutation.isPending || rejectMutation.isPending

  return (
    <li
      data-testid={`pending-comment-${comment.id}`}
      className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2"
    >
      <Link
        to="/books/$bookId"
        params={{ bookId: comment.book.id }}
        className="text-xs font-semibold text-[var(--blue-deep)] no-underline hover:underline"
      >
        {comment.book.title}
      </Link>
      <p className="mt-1 text-xs font-semibold text-[var(--text)]">
        {comment.author_name}
      </p>
      <p className="mt-0.5 text-sm text-[var(--text)]">
        {truncate(comment.body, 140)}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          data-testid={`pending-comment-approve-${comment.id}`}
          onClick={() => approveMutation.mutate()}
          disabled={isBusy}
          className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          data-testid={`pending-comment-reject-${comment.id}`}
          onClick={() => rejectMutation.mutate()}
          disabled={isBusy}
          className="rounded-full border border-red-400 px-2.5 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </li>
  )
}
