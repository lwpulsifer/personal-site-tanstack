import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { marked } from 'marked'
import { sanitize } from '#/lib/sanitize'
import { SITE_URL } from '#/lib/site'
import { BuyMeACoffee } from '#/components/BuyMeACoffee'
import { PostEditor } from '#/components/PostEditor'
import { useAuth } from '#/lib/auth'
import { getPublishedPost } from '#/server/posts'

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => {
    const post = await getPublishedPost({ data: { slug: params.slug } })
    if (!post) throw notFound()
    return post
  },
  headers: () => ({
    'cache-control': 'public, max-age=604800, s-maxage=604800',
  }),
  head: ({ loaderData, params }) => {
    const title = loaderData?.title ?? 'Post'
    const description = loaderData?.description ?? ''
    const image = loaderData?.hero_image ?? ''
    return {
      links: [{ rel: 'canonical', href: `${SITE_URL}/blog/${params.slug}` }],
      meta: [
        { title: `${title} — Liam Pulsifer` },
        { name: 'description', content: description },
        ...(image
          ? [
              {
                property: 'og:image',
                content: image.startsWith('http')
                  ? image
                  : `${SITE_URL}${image}`,
              },
            ]
          : []),
      ],
    }
  },
  component: BlogPost,
})

function BlogPost() {
  const post = Route.useLoaderData()
  const { isAuthenticated } = useAuth()
  const [isEditing, setIsEditing] = useState(false)

  const renderedHtml = useMemo(
    () => sanitize(marked.parse(post.content) as string),
    [post.content],
  )

  const formattedDate = new Date(
    post.published_at ?? post.created_at,
  ).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      {isEditing && (
        <PostEditor
          initial={{
            id: post.id,
            slug: post.slug,
            title: post.title,
            description: post.description ?? '',
            content: post.content,
            tags: post.tags,
            hero_image: post.hero_image ?? '',
            status: post.status,
          }}
          onClose={() => setIsEditing(false)}
          onSaved={() => setIsEditing(false)}
        />
      )}

      <main className="page-wrap px-4 pb-12 pt-16">
        <article className="island-shell rounded-2xl p-6 sm:p-8">
          <div className="mb-6 border-b border-[var(--border)] pb-4">
            <Link
              to="/blog"
              className="text-sm font-semibold text-[var(--blue-deep)] no-underline hover:underline"
            >
              ← Back to all posts
            </Link>
          </div>

          {post.hero_image ? (
            <img
              src={post.hero_image}
              alt=""
              className="mb-6 h-64 w-full rounded-2xl object-cover"
            />
          ) : null}

          {post.tags.length > 0 && (
            <p className="island-kicker mb-2">{post.tags[0]}</p>
          )}

          <div className="mb-3 flex items-start justify-between gap-4">
            <h1 className="display-title text-4xl font-bold text-[var(--text)] sm:text-5xl">
              {post.title}
            </h1>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="mt-1 shrink-0 rounded-full border border-[var(--blue-deep)] px-3 py-1 text-xs font-semibold text-[var(--blue-deep)] transition hover:bg-[var(--blue-deep)] hover:text-white"
              >
                Edit
              </button>
            )}
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
            <time dateTime={post.published_at ?? post.created_at}>
              {formattedDate}
            </time>
            {post.tags.length > 1 && (
              <>
                <span aria-hidden>·</span>
                <span>{post.tags.join(', ')}</span>
              </>
            )}
          </div>

          <div className="mb-6 flex justify-end">
            <BuyMeACoffee variant="prominent" />
          </div>

          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: rendered from trusted DB content
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            className="prose prose-slate prose-headings:text-[var(--text)] prose-p:text-[var(--text-muted)] prose-li:text-[var(--text-muted)] prose-ul:text-[var(--text-muted)] prose-ol:text-[var(--text-muted)] prose-strong:text-[var(--text)] prose-a:text-[var(--blue-deep)] max-w-none"
          />

          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <Link
              to="/blog"
              className="text-sm font-semibold text-[var(--blue-deep)] no-underline hover:underline"
            >
              ← Back to all posts
            </Link>
          </div>
        </article>
      </main>
    </>
  )
}
