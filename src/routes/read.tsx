import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '#/lib/auth'
import { feedItemsQueryOptions, feedsQueryOptions } from '#/lib/queries'
import { SITE_TITLE, SITE_URL } from '#/lib/site'
import {
  addFeed,
  deleteFeed,
  getFeedItems,
  getFeeds,
  refreshAllFeeds,
} from '#/server/feeds'

const canonical = `${SITE_URL}/read`
const pageTitle = `Read | ${SITE_TITLE}`
const pageDescription =
  "What I'm reading — a live feed of posts from sites I subscribe to."

export const Route = createFileRoute('/read')({
  loader: async () => {
    const [items, feeds] = await Promise.all([getFeedItems(), getFeeds()])
    return { items, feeds }
  },
  head: () => ({
    links: [{ rel: 'canonical', href: canonical }],
    meta: [
      { title: pageTitle },
      { name: 'description', content: pageDescription },
    ],
  }),
  component: ReadPage,
})

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ReadPage() {
  const { items: initialItems, feeds: initialFeeds } = Route.useLoaderData()
  const { isAuthenticated } = useAuth()
  const qc = useQueryClient()

  const { data: items = initialItems } = useQuery({
    ...feedItemsQueryOptions,
    initialData: initialItems,
  })
  const { data: feeds = initialFeeds } = useQuery({
    ...feedsQueryOptions,
    initialData: initialFeeds,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: feedItemsQueryOptions.queryKey })
    qc.invalidateQueries({ queryKey: feedsQueryOptions.queryKey })
  }

  const [url, setUrl] = useState('')

  const addMut = useMutation({
    mutationFn: (u: string) => addFeed({ data: { url: u } }),
    onSuccess: () => {
      setUrl('')
      invalidate()
    },
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFeed({ data: { id } }),
    onSuccess: invalidate,
  })
  const refreshMut = useMutation({
    mutationFn: () => refreshAllFeeds(),
    onSuccess: invalidate,
  })

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="mb-6">
        <p className="island-kicker mb-2">From the wider web</p>
        <h1
          data-testid="read-heading"
          className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl"
        >
          Read
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          A live feed of posts from sites I'm subscribed to.
        </p>
      </section>

      {isAuthenticated && (
        <section
          data-testid="feeds-admin"
          className="island-shell mb-8 rounded-2xl p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="m-0 text-lg font-semibold">Subscriptions</h2>
            <button
              type="button"
              data-testid="refresh-feeds-btn"
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending || feeds.length === 0}
              className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold text-[var(--text)] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {refreshMut.isPending ? 'Refreshing…' : 'Refresh all'}
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const trimmed = url.trim()
              if (trimmed) addMut.mutate(trimmed)
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/rss.xml"
              required
              data-testid="feed-url-input"
              className="min-w-[260px] flex-1 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-4 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--blue)]"
            />
            <button
              type="submit"
              data-testid="add-feed-btn"
              disabled={addMut.isPending}
              className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-60"
            >
              {addMut.isPending ? 'Adding…' : '+ Add Feed'}
            </button>
          </form>

          {addMut.isError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Failed to add: {(addMut.error as Error).message}
            </p>
          )}

          {feeds.length > 0 && (
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {feeds.map((feed) => (
                <li
                  key={feed.id}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate font-semibold text-[var(--text)]">
                      {feed.title ?? feed.url}
                    </p>
                    <p className="m-0 truncate text-xs text-[var(--text-muted)]">
                      {feed.url}
                    </p>
                    {feed.last_error && (
                      <p className="m-0 truncate text-xs text-red-600 dark:text-red-400">
                        Error: {feed.last_error}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(feed.id)}
                    className="text-xs text-[var(--text-muted)] underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {items.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          {feeds.length === 0
            ? 'No subscriptions yet.'
            : "No posts to show yet — try refreshing."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const sourceLabel = item.feed_title ?? item.feed_url
            const date = formatDate(item.published_at)
            return (
              <li key={item.id}>
                <article className="island-shell flex h-full flex-col rounded-2xl p-5">
                  <p className="island-kicker m-0 mb-2">
                    {item.feed_site_url ? (
                      <a
                        href={item.feed_site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline"
                      >
                        {sourceLabel}
                      </a>
                    ) : (
                      sourceLabel
                    )}
                  </p>
                  <h3 className="m-0 text-xl font-semibold text-[var(--text)]">
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                  {item.description && (
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {item.description}
                    </p>
                  )}
                  {(item.author || date) && (
                    <p className="m-0 mt-auto pt-3 text-xs text-[var(--text-muted)]">
                      {item.author && <>{item.author} · </>}
                      {date}
                    </p>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
