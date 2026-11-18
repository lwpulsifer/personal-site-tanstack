import type { JSX } from '@solidjs/web'
import { Show } from 'solid-js'
import { paths } from '../../router'
import type { DbPost } from '../../server/posts'
import { AdminActions } from './AdminActions'
import { StatusBadge } from './StatusBadge'

type PostCardProps = {
  post: DbPost
  /** Larger image, slightly more padding — used for the first/featured card. */
  featured?: boolean
  /** No hero image, smaller title — used in the archived list. */
  compact?: boolean
  showAdmin: boolean
  onEdit: (post: DbPost) => void
  class?: string
  style?: JSX.CSSProperties
}

export function PostCard(props: PostCardProps) {
  return (
    <article
      data-testid={`post-card-${props.post.slug}`}
      class={`island-shell rounded-2xl p-5 ${props.featured ? 'sm:p-6' : ''} ${props.class ?? ''}`}
      style={props.style}
    >
      <Show when={!props.compact && props.post.hero_image}>
        <img
          src={props.post.hero_image!}
          alt=""
          class={`mb-4 h-44 w-full rounded-xl object-cover ${props.featured ? 'xl:h-60' : ''}`}
        />
      </Show>

      <div class="mb-2 flex items-center gap-2">
        <Show when={props.showAdmin}>
          <StatusBadge status={props.post.status} />
        </Show>
        <Show when={props.post.tags.length > 0}>
          <p class="island-kicker m-0">{props.post.tags[0]}</p>
        </Show>
      </div>

      <h2
        data-testid={`post-title-${props.post.slug}`}
        class={`m-0 font-semibold text-[var(--text)] ${props.compact ? 'text-xl' : 'text-2xl'}`}
      >
        <Show when={props.post.status === 'PUBLISHED'} fallback={props.post.title}>
          <a
            href={paths.blog(props.post.slug)}
            data-testid={`post-link-${props.post.slug}`}
            class="no-underline"
          >
            {props.post.title}
          </a>
        </Show>
      </h2>

      <Show when={props.post.description}>
        <p
          class={`mb-2 text-[var(--text-muted)] ${props.featured ? 'mt-3 text-base' : 'mt-2 text-sm'}`}
        >
          {props.post.description}
        </p>
      </Show>

      <p class="m-0 text-xs text-[var(--text-muted)]">
        {new Date(props.post.published_at ?? props.post.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>

      <Show when={props.showAdmin}>
        <AdminActions post={props.post} onEdit={props.onEdit} />
      </Show>
    </article>
  )
}
