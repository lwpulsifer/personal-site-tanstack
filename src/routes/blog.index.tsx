import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '#/lib/site'
import { PostEditor } from '#/components/PostEditor'
import { useAuth } from '#/lib/auth'
import {
  getAdminPosts,
  getPublishedPosts,
  setPostStatus,
  type DbPost,
  type PostStatus,
} from '#/server/posts'

const canonical = `${SITE_URL}/blog`
const pageTitle = `Blog | ${SITE_TITLE}`

export const Route = createFileRoute('/blog/')({
  loader: async () => getPublishedPosts(),
  head: () => ({
    links: [{ rel: 'canonical', href: canonical }],
    meta: [
      { title: pageTitle },
      { name: 'description', content: SITE_DESCRIPTION },
    ],
  }),
  component: BlogIndex,
})

const STATUS_STYLES: Record<PostStatus, string> = {
  PUBLISHED:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ARCHIVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

function AdminActions({
  post,
  onStatusChange,
  onEdit,
}: {
  post: DbPost
  onStatusChange: (id: string, status: PostStatus) => void
  onEdit: (post: DbPost) => void
}) {
  const [acting, setActing] = useState(false)

  async function changeStatus(next: PostStatus) {
    setActing(true)
    try {
      await setPostStatus({ data: { postId: post.id, status: next } })
      onStatusChange(post.id, next)
    } finally {
      setActing(false)
    }
  }

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
          onClick={() => changeStatus('PUBLISHED')}
          disabled={acting}
          className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Publish
        </button>
      )}

      {post.status === 'PUBLISHED' && (
        <button
          type="button"
          onClick={() => changeStatus('ARCHIVED')}
          disabled={acting}
          className="rounded-full bg-gray-500 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-gray-600 disabled:opacity-50"
        >
          Archive
        </button>
      )}

      {post.status === 'ARCHIVED' && (
        <button
          type="button"
          onClick={() => changeStatus('PENDING')}
          disabled={acting}
          className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          Restore
        </button>
      )}
    </div>
  )
}

function PostDate({ post }: { post: DbPost }) {
  return (
    <p className="m-0 text-xs text-[var(--text-muted)]">
      {new Date(post.published_at ?? post.created_at).toLocaleDateString(
        'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' },
      )}
    </p>
  )
}

function BlogIndex() {
  const publishedPosts = Route.useLoaderData()
  const { isAuthenticated } = useAuth()

  const [tagFilter, setTagFilter] = useState('')
  const [adminPosts, setAdminPosts] = useState<DbPost[]>([])
  const [adminLoaded, setAdminLoaded] = useState(false)
  const [editingPost, setEditingPost] = useState<DbPost | 'new' | null>(null)

  // Fetch all posts (including drafts/archived) for admin view
  useEffect(() => {
    if (!isAuthenticated) return
    getAdminPosts()
      .then(setAdminPosts)
      .finally(() => setAdminLoaded(true))
  }, [isAuthenticated])

  function handleStatusChange(id: string, status: PostStatus) {
    setAdminPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p)),
    )
  }

  // Admin sees all posts; public sees only published
  const displayPosts =
    isAuthenticated && adminLoaded ? adminPosts : publishedPosts

  const allTags = [
    ...new Set(displayPosts.flatMap((p) => p.tags)),
  ].sort()

  const sortKey = (p: DbPost) =>
    new Date(p.published_at ?? p.created_at).valueOf()

  const filtered = displayPosts
    .filter(
      (p) =>
        !tagFilter ||
        p.tags.some((t) => t.toLowerCase().startsWith(tagFilter.toLowerCase())),
    )
    .sort((a, b) => sortKey(b) - sortKey(a))

  const activePosts = filtered.filter((p) => p.status !== 'ARCHIVED')
  const archivedPosts = filtered.filter((p) => p.status === 'ARCHIVED')

  const featured = activePosts[0]
  const rest = activePosts.slice(1)

  return (
    <>
      {editingPost && (
        <PostEditor
          initial={
            editingPost === 'new'
              ? {}
              : {
                  id: editingPost.id,
                  slug: editingPost.slug,
                  title: editingPost.title,
                  description: editingPost.description ?? '',
                  content: editingPost.content,
                  tags: editingPost.tags,
                  hero_image: editingPost.hero_image ?? '',
                  status: editingPost.status,
                }
          }
          onClose={() => setEditingPost(null)}
          onSaved={(saved) => {
            setAdminPosts((prev) => {
              const exists = prev.find((p) => p.id === saved.id)
              if (exists)
                return prev.map((p) =>
                  p.id === saved.id ? { ...saved, status: p.status } : p,
                )
              return [{ ...saved, status: 'PENDING' as PostStatus }, ...prev]
            })
            setEditingPost(null)
          }}
        />
      )}

      <main className="page-wrap px-4 pb-8 pt-14">
        <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="island-kicker mb-2">Latest Dispatches</p>
            <h1 className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
              Blog
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setEditingPost('new')}
                className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
              >
                + New Post
              </button>
            )}

            {allTags.length > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  list="tag-options"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="Filter by tag"
                  className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-4 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--blue)]"
                />
                <datalist id="tag-options">
                  {allTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
                {tagFilter && (
                  <button
                    type="button"
                    onClick={() => setTagFilter('')}
                    className="text-sm text-[var(--text-muted)] underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {activePosts.length === 0 && archivedPosts.length === 0 ? (
          <p className="text-[var(--text-muted)]">No posts found.</p>
        ) : activePosts.length === 0 ? null : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured && (
              <article className="island-shell rise-in rounded-2xl p-5 sm:p-6 lg:col-span-2">
                {featured.hero_image && (
                  <img
                    src={featured.hero_image}
                    alt=""
                    className="mb-4 h-44 w-full rounded-xl object-cover xl:h-60"
                  />
                )}
                <div className="mb-2 flex items-center gap-2">
                  {isAuthenticated && (
                    <StatusBadge status={featured.status} />
                  )}
                  {featured.tags.length > 0 && (
                    <p className="island-kicker m-0">{featured.tags[0]}</p>
                  )}
                </div>
                <h2 className="m-0 text-2xl font-semibold text-[var(--text)]">
                  {featured.status === 'PUBLISHED' ? (
                    <Link
                      to="/blog/$slug"
                      params={{ slug: featured.slug }}
                      className="no-underline"
                    >
                      {featured.title}
                    </Link>
                  ) : (
                    featured.title
                  )}
                </h2>
                <p className="mb-2 mt-3 text-base text-[var(--text-muted)]">
                  {featured.description}
                </p>
                <PostDate post={featured} />
                {isAuthenticated && adminLoaded && (
                  <AdminActions
                    post={featured}
                    onStatusChange={handleStatusChange}
                    onEdit={setEditingPost}
                  />
                )}
              </article>
            )}

            {rest.map((post, index) => (
              <article
                key={post.id}
                className="island-shell rise-in rounded-2xl p-5 sm:last:col-span-2 lg:last:col-span-1"
                style={{ animationDelay: `${index * 80 + 120}ms` }}
              >
                {post.hero_image && (
                  <img
                    src={post.hero_image}
                    alt=""
                    className="mb-4 h-44 w-full rounded-xl object-cover"
                  />
                )}
                <div className="mb-2 flex items-center gap-2">
                  {isAuthenticated && <StatusBadge status={post.status} />}
                  {post.tags.length > 0 && (
                    <p className="island-kicker m-0">{post.tags[0]}</p>
                  )}
                </div>
                <h2 className="m-0 text-2xl font-semibold text-[var(--text)]">
                  {post.status === 'PUBLISHED' ? (
                    <Link
                      to="/blog/$slug"
                      params={{ slug: post.slug }}
                      className="no-underline"
                    >
                      {post.title}
                    </Link>
                  ) : (
                    post.title
                  )}
                </h2>
                <p className="mb-2 mt-2 text-sm text-[var(--text-muted)]">
                  {post.description}
                </p>
                <PostDate post={post} />
                {isAuthenticated && adminLoaded && (
                  <AdminActions
                    post={post}
                    onStatusChange={handleStatusChange}
                    onEdit={setEditingPost}
                  />
                )}
              </article>
            ))}
          </section>
        )}

        {isAuthenticated && archivedPosts.length > 0 && (
          <details className="mt-12 group">
            <summary className="island-kicker mb-3 cursor-pointer select-none list-none">
              <span>Archived ({archivedPosts.length})</span>
              <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
              {archivedPosts.map((post) => (
                <article
                  key={post.id}
                  className="island-shell rounded-2xl p-5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <StatusBadge status={post.status} />
                    {post.tags.length > 0 && (
                      <p className="island-kicker m-0">{post.tags[0]}</p>
                    )}
                  </div>
                  <h2 className="m-0 text-xl font-semibold text-[var(--text)]">
                    {post.title}
                  </h2>
                  {post.description && (
                    <p className="mb-2 mt-2 text-sm text-[var(--text-muted)]">
                      {post.description}
                    </p>
                  )}
                  <PostDate post={post} />
                  <AdminActions
                    post={post}
                    onStatusChange={handleStatusChange}
                    onEdit={setEditingPost}
                  />
                </article>
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  )
}
