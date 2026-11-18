import { createSignal, Show } from 'solid-js'
import { type DbPost, type PostStatus, setPostStatus } from '../../server/posts'

export function AdminActions(props: { post: DbPost; onEdit: (post: DbPost) => void }) {
  const [pending, setPending] = createSignal(false)

  // setPostStatus is a POST server function, so on-screen queries (the admin
  // post list) revalidate afterwards — no manual invalidateQueries needed.
  async function mutate(status: PostStatus) {
    setPending(true)
    try {
      await setPostStatus(props.post.id, status)
    } finally {
      setPending(false)
    }
  }

  return (
    <div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-[var(--border)] pt-3">
      <button
        type="button"
        data-testid="post-edit"
        onClick={() => props.onEdit(props.post)}
        class="rounded-full border border-[var(--blue-deep)] px-2.5 py-0.5 text-xs font-semibold text-[var(--blue-deep)] transition hover:bg-[var(--blue-deep)] hover:text-white"
      >
        Edit
      </button>

      <Show when={props.post.status !== 'PUBLISHED'}>
        <button
          type="button"
          data-testid="post-publish"
          onClick={() => mutate('PUBLISHED')}
          disabled={pending()}
          class="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Publish
        </button>
      </Show>
      <Show when={props.post.status === 'PUBLISHED'}>
        <button
          type="button"
          data-testid="post-archive"
          onClick={() => mutate('ARCHIVED')}
          disabled={pending()}
          class="rounded-full bg-gray-500 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-gray-600 disabled:opacity-50"
        >
          Archive
        </button>
      </Show>
      <Show when={props.post.status === 'ARCHIVED'}>
        <button
          type="button"
          data-testid="post-restore"
          onClick={() => mutate('PENDING')}
          disabled={pending()}
          class="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          Restore
        </button>
      </Show>
    </div>
  )
}
