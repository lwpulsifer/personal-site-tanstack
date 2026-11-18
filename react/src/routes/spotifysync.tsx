import { createFileRoute, notFound } from '@tanstack/react-router'
import { SITE_TITLE } from '#/lib/site'
import { getServerUser } from '#/server/auth'
import { getAuthorizeUrl } from '#/server/spotify'

const pageTitle = `Spotify Sync | ${SITE_TITLE}`

export const Route = createFileRoute('/spotifysync')({
  // Admin-only, hidden behind a 404 like /people — this page kicks off an
  // OAuth flow tied to the site owner's own Spotify account.
  beforeLoad: async () => {
    const user = await getServerUser()
    if (!user) throw notFound()
  },
  loader: async () => getAuthorizeUrl(),
  head: () => ({
    meta: [{ title: pageTitle }, { name: 'robots', content: 'noindex' }],
  }),
  component: SpotifySyncPage,
})

function SpotifySyncPage() {
  const authorizeUrl = Route.useLoaderData()

  return (
    <main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div className="island-shell rise-in w-full max-w-md rounded-[2rem] px-8 py-10 text-center">
        <p className="island-kicker mb-3">Admin</p>
        <h1
          data-testid="spotify-sync-heading"
          className="display-title mb-4 text-2xl font-bold text-[var(--text)]"
        >
          Reconnect Spotify
        </h1>
        <p className="mb-8 text-sm text-[var(--text-muted)]">
          Use this if the "now playing" widget stops working because Spotify
          revoked the refresh token. You'll approve access, land back here with
          a new token, and need to update{' '}
          <code className="rounded bg-[var(--chip-bg)] px-1 py-0.5">
            SPOTIFY_REFRESH_TOKEN
          </code>{' '}
          yourself.
        </p>
        <a
          href={authorizeUrl}
          data-testid="spotify-connect-link"
          className="inline-block rounded-full bg-[var(--blue-deep)] px-5 py-2.5 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
        >
          Connect Spotify
        </a>
      </div>
    </main>
  )
}
