import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setPostStatus, type DbPost, type PostStatus } from '#/server/posts'
import { adminPostsQueryOptions } from '#/lib/queries'

export function AdminActions({
  post,
  onEdit,
}: {
  post: DbPost
  onEdit: (post: DbPost) => void
}) {
  const queryClient = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: (status: PostStatus) =>
      setPostStatus({ data: { postId: post.id, status } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminPostsQueryOptions.queryKey }),
  })

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-[var(--border)] pt-3">
      <button
        type="button"
        onClick={() => onEdit(post)}
        className="rounded-full border border-[var(--blue-deep)] px-2.5 py-0.5 text-xs font-semibold text-[var(--blue-deep)] transition hover:bg-[var(--blue-deep)] hover:text-white"
      >
        Edit
      </button>

      {post.status !== 'PUBLISHED' && (
        <button
          type="button"
          onClick={() => mutate('PUBLISHED')}
          disabled={isPending}
          className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Publish
        </button>
      )}
      {post.status === 'PUBLISHED' && (
        <button
          type="button"
          onClick={() => mutate('ARCHIVED')}
          disabled={isPending}
          className="rounded-full bg-gray-500 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-gray-600 disabled:opacity-50"
        >
          Archive
        </button>
      )}
      {post.status === 'ARCHIVED' && (
        <button
          type="button"
          onClick={() => mutate('PENDING')}
          disabled={isPending}
          className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          Restore
        </button>
      )}
    </div>
  )
}
