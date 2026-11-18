import { Link, Meta, Title } from '@solidjs/meta'
import type { RouteDefinition } from '@solidjs/router'
import { createMemo, createSignal, createUniqueId, For, Show } from 'solid-js'
import { BuyMeACoffee } from '../../components/BuyMeACoffee'
import { PostCard } from '../../components/blog/PostCard'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { PostEditor } from '../../components/PostEditor'
import { useAuth } from '../../lib/auth'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../../lib/site'
import { type DbPost, getAdminPosts, getAllTags, getPublishedPosts } from '../../server/posts'

// Hover/focus on a link to /blog starts this fetch, so the data is usually
// warm by the time the click lands.
export const route = {
  preload: () => {
    void getPublishedPosts()
  },
} satisfies RouteDefinition

export default function BlogIndex() {
  const { isAuthenticated } = useAuth()
  const tagDatalistId = createUniqueId()

  const [tagFilter, setTagFilter] = createSignal('')
  const [editingPost, setEditingPost] = createSignal<DbPost | 'new' | null>(null)

  const publishedPosts = createMemo(() => getPublishedPosts())
  // Admin sees all posts (including drafts/archived); public sees only published.
  // Mutations are POST server functions, so these queries revalidate on their own.
  // A failed admin fetch (e.g. expired session) degrades to the public list
  // instead of halting the page, like React Query's error state did.
  const adminPosts = createMemo(() =>
    isAuthenticated() ? getAdminPosts().catch(() => undefined) : undefined,
  )
  const knownTags = createMemo(() =>
    isAuthenticated() ? getAllTags().catch(() => [] as string[]) : [],
  )

  const displayPosts = () => adminPosts() ?? publishedPosts()

  const allTags = createMemo(() => [...new Set(displayPosts().flatMap((p) => p.tags))].sort())

  const grouped = createMemo(() => {
    const filter = tagFilter().toLowerCase()
    const sorted = displayPosts()
      .filter((p) => !filter || p.tags.some((t) => t.toLowerCase().startsWith(filter)))
      .sort(
        (a, b) =>
          new Date(b.published_at ?? b.created_at).valueOf() -
          new Date(a.published_at ?? a.created_at).valueOf(),
      )
    return {
      active: sorted.filter((p) => p.status !== 'ARCHIVED'),
      archived: sorted.filter((p) => p.status === 'ARCHIVED'),
    }
  })
  const featured = () => grouped().active[0]
  const rest = () => grouped().active.slice(1)

  const initialFor = (post: DbPost | 'new') =>
    post === 'new'
      ? {}
      : {
          id: post.id,
          slug: post.slug,
          title: post.title,
          description: post.description ?? '',
          content: post.content,
          tags: post.tags,
          hero_image: post.hero_image ?? '',
          status: post.status,
        }

  return (
    <>
      <Title>{`Blog | ${SITE_TITLE}`}</Title>
      <Link rel="canonical" href={`${SITE_URL}/blog`} />
      <Meta name="description" content={SITE_DESCRIPTION} />

      <Show when={editingPost()}>
        {(editing) => (
          <ErrorBoundary>
            <PostEditor
              initial={initialFor(editing())}
              knownTags={knownTags()}
              onClose={() => setEditingPost(null)}
              onSaved={() => setEditingPost(null)}
            />
          </ErrorBoundary>
        )}
      </Show>

      <main class="page-wrap px-4 pb-8 pt-14">
        <section class="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="island-kicker mb-2">Latest Dispatches</p>
            <h1
              data-testid="blog-heading"
              class="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl"
            >
              Blog
            </h1>
          </div>

          <div class="flex items-center gap-2">
            <BuyMeACoffee variant="prominent" label="Like the blog? Buy me a coffee!" />
            <Show when={isAuthenticated()}>
              <button
                type="button"
                data-testid="new-post-btn"
                onClick={() => setEditingPost('new')}
                class="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
              >
                + New Post
              </button>
            </Show>

            <Show when={allTags().length > 0}>
              <div class="flex items-center gap-2">
                <input
                  type="search"
                  data-testid="tag-filter"
                  list={tagDatalistId}
                  value={tagFilter()}
                  onInput={(e) => setTagFilter(e.currentTarget.value)}
                  placeholder="Filter by tag"
                  class="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-4 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--blue)]"
                />
                <datalist id={tagDatalistId}>
                  <For each={allTags()}>{(tag) => <option value={tag} />}</For>
                </datalist>
                <Show when={tagFilter()}>
                  <button
                    type="button"
                    data-testid="tag-clear-btn"
                    onClick={() => setTagFilter('')}
                    class="text-sm text-[var(--text-muted)] underline"
                  >
                    Clear
                  </button>
                </Show>
              </div>
            </Show>
          </div>
        </section>

        <Show
          when={grouped().active.length > 0 || grouped().archived.length > 0}
          fallback={<p class="text-[var(--text-muted)]">No posts found.</p>}
        >
          <Show when={grouped().active.length > 0}>
            <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Show when={featured()}>
                {(post) => (
                  <PostCard
                    post={post()}
                    featured
                    showAdmin={isAuthenticated()}
                    onEdit={setEditingPost}
                    class="rise-in lg:col-span-2"
                  />
                )}
              </Show>
              <For each={rest()}>
                {(post, i) => (
                  <PostCard
                    post={post}
                    showAdmin={isAuthenticated()}
                    onEdit={setEditingPost}
                    class="rise-in sm:last:col-span-2 lg:last:col-span-1"
                    style={{ 'animation-delay': `${i() * 80 + 120}ms` }}
                  />
                )}
              </For>
            </section>
          </Show>
        </Show>

        <Show when={isAuthenticated() && grouped().archived.length > 0}>
          <details class="group mt-12">
            <summary
              data-testid="archived-summary"
              class="island-kicker mb-3 cursor-pointer select-none list-none"
            >
              <span>Archived ({grouped().archived.length})</span>
              <span class="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
            </summary>
            <div class="grid gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
              <For each={grouped().archived}>
                {(post) => <PostCard post={post} compact showAdmin onEdit={setEditingPost} />}
              </For>
            </div>
          </details>
        </Show>
      </main>
    </>
  )
}
