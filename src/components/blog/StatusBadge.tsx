import type { PostStatus } from '../../server/posts'

export const STATUS_STYLES: Record<PostStatus, string> = {
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ARCHIVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function StatusBadge(props: { status: PostStatus }) {
  return (
    <span class={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[props.status]}`}>
      {props.status}
    </span>
  )
}
