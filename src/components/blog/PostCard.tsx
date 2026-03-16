import { Link } from '@tanstack/react-router'
import type { DbPost } from '#/server/posts'
import { StatusBadge } from './StatusBadge'
import { AdminActions } from './AdminActions'

function PostDate({ post }: { post: DbPost }) {
  return (
    <p className="m-0 text-xs text-[var(--text-muted)]">
      {new Date(post.published_at ?? post.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}
    </p>
  )
}

type PostCardProps = {
  post: DbPost
  /** Larger image, slightly more padding — used for the first/featured card. */
  featured?: boolean
  /** No hero image, smaller title — used in the archived list. */
  compact?: boolean
  showAdmin: boolean
  onEdit: (post: DbPost) => void
  className?: string
  style?: React.CSSProperties
}

export function PostCard({
  post,
  featured = false,
  compact = false,
  showAdmin,
  onEdit,
  className = '',
  style,
}: PostCardProps) {
  const title =
    post.status === 'PUBLISHED' ? (
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        data-testid={`post-link-${post.slug}`}
        className="no-underline"
      >
        {post.title}
      </Link>
    ) : (
      post.title
    )

  return (
    <article
      data-testid={`post-card-${post.slug}`}
      className={`island-shell rounded-2xl p-5 ${featured ? 'sm:p-6' : ''} ${className}`}
      style={style}
    >
      {!compact && post.hero_image && (
        <img
          src={post.hero_image}
          alt=""
          className={`mb-4 h-44 w-full rounded-xl object-cover ${featured ? 'xl:h-60' : ''}`}
        />
      )}

      <div className="mb-2 flex items-center gap-2">
        {showAdmin && <StatusBadge status={post.status} />}
        {post.tags.length > 0 && (
          <p className="island-kicker m-0">{post.tags[0]}</p>
        )}
      </div>

      <h2 className={`m-0 font-semibold text-[var(--text)] ${compact ? 'text-xl' : 'text-2xl'}`}>
        {title}
      </h2>

      {post.description && (
        <p className={`mb-2 text-[var(--text-muted)] ${featured ? 'mt-3 text-base' : 'mt-2 text-sm'}`}>
          {post.description}
        </p>
      )}

      <PostDate post={post} />

      {showAdmin && <AdminActions post={post} onEdit={onEdit} />}
    </article>
  )
}
