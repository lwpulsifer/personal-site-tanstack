import { Link, createFileRoute } from '@tanstack/react-router'
import { allBlogs } from 'content-collections'
import { useState } from 'react'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '#/lib/site'

const canonical = `${SITE_URL}/blog`
const pageTitle = `Blog | ${SITE_TITLE}`

export const Route = createFileRoute('/blog/')({
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
  const [tagFilter, setTagFilter] = useState('')

  const allTags = [
    ...new Set(
      allBlogs
        .filter((p) => p.display !== false)
        .flatMap((p) => (p.tags ? p.tags.split(',').map((t) => t.trim()) : [])),
    ),
  ].sort()

  const posts = Array.from(
    new Map(
      [...allBlogs]
        .filter((p) => p.display !== false)
        .filter(
          (p) =>
            !tagFilter ||
            (p.tags ?? '')
              .split(',')
              .map((t) => t.trim())
              .some((t) => t.startsWith(tagFilter)),
        )
        .sort(
          (a, b) =>
            new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf(),
        )
        .map((post) => [post.slug, post]),
    ).values(),
  )

  const featured = posts[0]
  const rest = posts.slice(1)

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="island-kicker mb-2">Latest Dispatches</p>
          <h1 className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
            Blog
          </h1>
        </div>
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
                onClick={() => setTagFilter('')}
                className="text-sm text-[var(--text-muted)] underline"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </section>

      {posts.length === 0 ? (
        <p className="text-[var(--text-muted)]">No posts found.</p>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured && (
            <article className="island-shell rise-in rounded-2xl p-5 sm:p-6 lg:col-span-2">
              {featured.heroImage ? (
                <img
                  src={featured.heroImage}
                  alt=""
                  className="mb-4 h-44 w-full rounded-xl object-cover xl:h-60"
                />
              ) : null}
              {featured.tags && (
                <p className="island-kicker mb-2">
                  {featured.tags.split(',')[0]?.trim()}
                </p>
              )}
              <h2 className="m-0 text-2xl font-semibold text-[var(--text)]">
                <Link
                  to="/blog/$slug"
                  params={{ slug: featured.slug }}
                  className="no-underline"
                >
                  {featured.title}
                </Link>
              </h2>
              <p className="mb-2 mt-3 text-base text-[var(--text-muted)]">
                {featured.description}
              </p>
              <p className="m-0 text-xs text-[var(--text-muted)]">
                {new Date(featured.pubDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </article>
          )}

          {rest.map((post, index) => (
            <article
              key={post.slug}
              className="island-shell rise-in rounded-2xl p-5 sm:last:col-span-2 lg:last:col-span-1"
              style={{ animationDelay: `${index * 80 + 120}ms` }}
            >
              {post.heroImage ? (
                <img
                  src={post.heroImage}
                  alt=""
                  className="mb-4 h-44 w-full rounded-xl object-cover"
                />
              ) : null}
              {post.tags && (
                <p className="island-kicker mb-2">
                  {post.tags.split(',')[0]?.trim()}
                </p>
              )}
              <h2 className="m-0 text-2xl font-semibold text-[var(--text)]">
                <Link
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  className="no-underline"
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mb-2 mt-2 text-sm text-[var(--text-muted)]">
                {post.description}
              </p>
              <p className="m-0 text-xs text-[var(--text-muted)]">
                {new Date(post.pubDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
