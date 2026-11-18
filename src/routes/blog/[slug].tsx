import { Link, Meta, Title } from '@solidjs/meta'
import { type RouteDefinition, useParams } from '@solidjs/router'
import { httpStatus } from '@solidjs/web'
import { marked } from 'marked'
import { createMemo, createSignal, Show } from 'solid-js'
import { sanitize } from '../../lib/sanitize'
import { BuyMeACoffee } from '../../components/BuyMeACoffee'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { NotFound } from '../../components/NotFound'
import { PostEditor } from '../../components/PostEditor'
import { useAuth } from '../../lib/auth'
import { SITE_URL } from '../../lib/site'
import { paths } from '../../router'
import { getPublishedPost } from '../../server/posts'

export const route = {
  preload: async ({ params }) => {
    const post = await getPublishedPost(params.slug ?? '')
    // Long-lived caching for published posts is set in src/middleware.ts:
    // headers can't be written from a preload once the response head flushes.
    if (!post) httpStatus(404)
  },
} satisfies RouteDefinition

function PostView(props: { slug: string }) {
  const { isAuthenticated } = useAuth()
  const [isEditing, setIsEditing] = createSignal(false)
  const post = createMemo(() => getPublishedPost(props.slug))

  return (
    <Show when={post()} fallback={<NotFound />}>
      {(p) => {
        const renderedHtml = createMemo(() => sanitize(marked.parse(p().content) as string))
        const image = () => p().hero_image ?? ''
        const formattedDate = () =>
          new Date(p().published_at ?? p().created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        return (
          <>
            <Title>{`${p().title} — Liam Pulsifer`}</Title>
            <Link rel="canonical" href={`${SITE_URL}/blog/${props.slug}`} />
            <Meta name="description" content={p().description ?? ''} />
            <Show when={image()}>
              <Meta
                property="og:image"
                content={image().startsWith('http') ? image() : `${SITE_URL}${image()}`}
              />
            </Show>

            <Show when={isEditing()}>
              <PostEditor
                initial={{
                  id: p().id,
                  slug: p().slug,
                  title: p().title,
                  description: p().description ?? '',
                  content: p().content,
                  tags: p().tags,
                  hero_image: p().hero_image ?? '',
                  status: p().status,
                }}
                onClose={() => setIsEditing(false)}
                onSaved={() => setIsEditing(false)}
              />
            </Show>

            <main class="page-wrap px-4 pb-12 pt-16">
              <article class="island-shell rounded-2xl p-6 sm:p-8">
                <div class="mb-6 border-b border-[var(--border)] pb-4">
                  <a
                    href={paths.blog()}
                    data-testid="post-back-link"
                    class="text-sm font-semibold text-[var(--blue-deep)] no-underline hover:underline"
                  >
                    ← Back to all posts
                  </a>
                </div>

                <Show when={p().hero_image}>
                  <img src={p().hero_image!} alt="" class="mb-6 h-64 w-full rounded-2xl object-cover" />
                </Show>

                <Show when={p().tags.length > 0}>
                  <p class="island-kicker mb-2">{p().tags[0]}</p>
                </Show>

                <div class="mb-3 flex items-start justify-between gap-4">
                  <h1
                    data-testid="post-heading"
                    class="display-title text-4xl font-bold text-[var(--text)] sm:text-5xl"
                  >
                    {p().title}
                  </h1>

                  <Show when={isAuthenticated()}>
                    <button
                      type="button"
                      data-testid="post-edit-btn"
                      onClick={() => setIsEditing(true)}
                      class="mt-1 shrink-0 rounded-full border border-[var(--blue-deep)] px-3 py-1 text-xs font-semibold text-[var(--blue-deep)] transition hover:bg-[var(--blue-deep)] hover:text-white"
                    >
                      Edit
                    </button>
                  </Show>
                </div>

                <div class="mb-6 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
                  <time datetime={p().published_at ?? p().created_at}>{formattedDate()}</time>
                  <Show when={p().tags.length > 1}>
                    <span aria-hidden="true">·</span>
                    <span>{p().tags.join(', ')}</span>
                  </Show>
                </div>

                <div class="mb-6 flex justify-end">
                  <BuyMeACoffee variant="prominent" />
                </div>

                <ErrorBoundary>
                  <div
                    data-testid="post-content"
                    innerHTML={renderedHtml()}
                    class="prose prose-slate prose-headings:text-[var(--text)] prose-p:text-[var(--text-muted)] prose-li:text-[var(--text-muted)] prose-ul:text-[var(--text-muted)] prose-ol:text-[var(--text-muted)] prose-strong:text-[var(--text)] prose-a:text-[var(--blue-deep)] max-w-none"
                  />
                </ErrorBoundary>

                <div class="mt-8 border-t border-[var(--border)] pt-6">
                  <a
                    href={paths.blog()}
                    data-testid="post-back-link-bottom"
                    class="text-sm font-semibold text-[var(--blue-deep)] no-underline hover:underline"
                  >
                    ← Back to all posts
                  </a>
                </div>
              </article>
            </main>
          </>
        )
      }}
    </Show>
  )
}

export default function BlogPost() {
  const params = useParams()
  return <PostView slug={params.slug ?? ''} />
}
