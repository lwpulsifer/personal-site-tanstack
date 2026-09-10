import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '#/lib/auth'
import { bookCommentsQueryOptions } from '#/lib/queries'
import {
  addComment,
  approveComment,
  type BookComment,
  rejectComment,
} from '#/server/comments'

function formatCommentDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function CommentItem({
  comment,
  isAdmin,
  onModerated,
}: {
  comment: BookComment
  isAdmin: boolean
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
      data-testid={`book-comment-item-${comment.id}`}
      className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--text)]">
          {comment.author_name}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {formatCommentDate(comment.created_at)}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
        {comment.body}
      </p>

      {comment.status === 'pending' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                Pending review
              </span>
              <button
                type="button"
                data-testid={`book-comment-approve-${comment.id}`}
                onClick={() => approveMutation.mutate()}
                disabled={isBusy}
                className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                data-testid={`book-comment-reject-${comment.id}`}
                onClick={() => rejectMutation.mutate()}
                disabled={isBusy}
                className="rounded-full border border-red-400 px-2.5 py-0.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
              >
                Reject
              </button>
            </>
          ) : (
            <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
              Awaiting approval — only visible to you
            </span>
          )}
        </div>
      )}
    </li>
  )
}

export function BookComments({ bookId }: { bookId: string }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const { data: comments } = useQuery(bookCommentsQueryOptions(bookId))
  const [authorName, setAuthorName] = useState('')
  const [body, setBody] = useState('')
  const [website, setWebsite] = useState('')

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['bookComments'] })
  }

  const submitMutation = useMutation({
    mutationFn: () =>
      addComment({ data: { bookId, authorName, body, website } }),
    onSuccess: () => {
      setAuthorName('')
      setBody('')
      invalidate()
    },
  })

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-4">
      <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
        Comments
      </p>

      {comments && comments.length > 0 && (
        <ul
          className="mb-4 flex flex-col gap-2"
          data-testid="book-comment-list"
        >
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isAdmin={isAuthenticated}
              onModerated={invalidate}
            />
          ))}
        </ul>
      )}

      <form
        data-testid="book-comment-form"
        onSubmit={(e) => {
          e.preventDefault()
          submitMutation.mutate()
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name"
          required
          maxLength={80}
          data-testid="book-comment-name-input"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          required
          maxLength={2000}
          rows={3}
          data-testid="book-comment-body-input"
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />

        {/* Honeypot — hidden from real visitors, bots that autofill it get silently dropped. */}
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 overflow-hidden opacity-0"
        />

        {submitMutation.isError && (
          <p className="text-xs text-red-500">
            {submitMutation.error instanceof Error
              ? submitMutation.error.message
              : 'Something went wrong. Please try again.'}
          </p>
        )}

        <button
          type="submit"
          data-testid="book-comment-submit"
          disabled={submitMutation.isPending}
          className="self-start rounded-full bg-[var(--blue-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          {submitMutation.isPending ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </div>
  )
}
