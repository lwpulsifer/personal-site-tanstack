import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { MDXContent } from '@content-collections/mdx/react'
import { allBlogs } from 'content-collections'
import { SITE_URL } from '#/lib/site'
import { MdxCallout } from '#/components/MdxCallout'
import { MdxMetrics } from '#/components/MdxMetrics'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = Array.from(
      new Map(
        [...allBlogs]
          .sort(
            (a, b) =>
              new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf(),
          )
          .map((entry) => [entry.slug, entry]),
      ).values(),
    ).find((entry) => entry.slug === params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.title ?? 'Post'
    const description = loaderData?.description ?? ''
    const image = loaderData?.heroImage ?? ''
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

  const tags = post.tags ? post.tags.split(',').map((t) => t.trim()) : []
  const formattedDate = new Date(post.pubDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <main className="page-wrap px-4 pb-12 pt-16">
      <article className="island-shell rounded-2xl p-6 sm:p-8">
        {post.heroImage ? (
          <img
            src={post.heroImage}
            alt=""
            className="mb-6 h-64 w-full rounded-2xl object-cover"
          />
        ) : null}

        {tags.length > 0 && (
          <p className="island-kicker mb-2">{tags[0]}</p>
        )}

        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--text)] sm:text-5xl">
          {post.title}
        </h1>

        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
          {post.author && <span>{post.author}</span>}
          {post.author && <span aria-hidden>·</span>}
          <time dateTime={post.pubDate}>{formattedDate}</time>
          {tags.length > 1 && (
            <>
              <span aria-hidden>·</span>
              <span>{tags.join(', ')}</span>
            </>
          )}
        </div>

        <div className="prose prose-slate prose-headings:text-[var(--text)] prose-p:text-[var(--text-muted)] prose-li:text-[var(--text-muted)] prose-ul:text-[var(--text-muted)] prose-ol:text-[var(--text-muted)] prose-strong:text-[var(--text)] prose-a:text-[var(--blue-deep)] max-w-none">
          {post.mdx ? (
            <MDXContent
              code={post.mdx}
              components={{ MdxCallout, MdxMetrics }}
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: post.html ?? '' }} />
          )}
        </div>

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
  )
}
