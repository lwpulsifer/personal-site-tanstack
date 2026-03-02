import { PostEditor } from '#/components/PostEditor'
import { PostCard } from '#/components/blog/PostCard'
import { useAuth } from '#/lib/auth'
import { adminPostsQueryOptions, allTagsQueryOptions } from '#/lib/queries'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '#/lib/site'
import { getPublishedPosts, type DbPost } from '#/server/posts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

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

function BlogIndex() {
  const publishedPosts = Route.useLoaderData()
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const [tagFilter, setTagFilter] = useState('')
  const [editingPost, setEditingPost] = useState<DbPost | 'new' | null>(null)

  const { data: adminPosts } = useQuery({
    ...adminPostsQueryOptions,
    enabled: isAuthenticated,
  })

  const { data: knownTags = [] } = useQuery({
    ...allTagsQueryOptions,
    enabled: isAuthenticated,
  })

  // Admin sees all posts (including drafts/archived); public sees only published.
  const displayPosts = isAuthenticated && adminPosts ? adminPosts : publishedPosts

  const allTags = [...new Set(displayPosts.flatMap((p) => p.tags))].sort()

  const sortKey = (p: DbPost) => new Date(p.published_at ?? p.created_at).valueOf()

  const filtered = displayPosts
    .filter(
      (p) =>
        !tagFilter ||
        p.tags.some((t) => t.toLowerCase().startsWith(tagFilter.toLowerCase())),
    )
    .sort((a, b) => sortKey(b) - sortKey(a))

  const activePosts = filtered.filter((p) => p.status !== 'ARCHIVED')
  const archivedPosts = filtered.filter((p) => p.status === 'ARCHIVED')
  const [featured, ...rest] = activePosts

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: adminPostsQueryOptions.queryKey })
    setEditingPost(null)
  }

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
          knownTags={knownTags}
          onClose={() => setEditingPost(null)}
          onSaved={handleSaved}
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
        ) : activePosts.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured && (
              <PostCard
                post={featured}
                featured
                showAdmin={isAuthenticated}
                onEdit={setEditingPost}
                className="rise-in lg:col-span-2"
              />
            )}
            {rest.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                showAdmin={isAuthenticated}
                onEdit={setEditingPost}
                className="rise-in sm:last:col-span-2 lg:last:col-span-1"
                style={{ animationDelay: `${i * 80 + 120}ms` }}
              />
            ))}
          </section>
        ) : null}

        {isAuthenticated && archivedPosts.length > 0 && (
          <details className="group mt-12">
            <summary className="island-kicker mb-3 cursor-pointer select-none list-none">
              <span>Archived ({archivedPosts.length})</span>
              <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="grid gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
              {archivedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  compact
                  showAdmin
                  onEdit={setEditingPost}
                />
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  )
}
