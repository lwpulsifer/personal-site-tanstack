import { Meta, Title } from '@solidjs/meta'
import type { RouteDefinition } from '@solidjs/router'
import { httpStatus } from '@solidjs/web'
import { createMemo, Show } from 'solid-js'
import { NotFound } from '../components/NotFound'
import { useAuth } from '../lib/auth'
import { SITE_TITLE } from '../lib/site'
import { getServerUser } from '../server/auth'
import { getAuthorizeUrl } from '../server/spotify'

// Admin-only, hidden behind a 404 like /people — this page kicks off an
// OAuth flow tied to the site owner's own Spotify account.
export const route = {
  preload: async () => {
    if (!(await getServerUser())) httpStatus(404)
  },
} satisfies RouteDefinition

function SyncContent() {
  const authorizeUrl = createMemo(() => getAuthorizeUrl())
  return (
    <main class="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div class="island-shell rise-in w-full max-w-md rounded-[2rem] px-8 py-10 text-center">
        <p class="island-kicker mb-3">Admin</p>
        <h1
          data-testid="spotify-sync-heading"
          class="display-title mb-4 text-2xl font-bold text-[var(--text)]"
        >
          Reconnect Spotify
        </h1>
        <p class="mb-8 text-sm text-[var(--text-muted)]">
          Use this if the "now playing" widget stops working because Spotify revoked the refresh
          token. You'll approve access, land back here with a new token, and need to update{' '}
          <code class="rounded bg-[var(--chip-bg)] px-1 py-0.5">SPOTIFY_REFRESH_TOKEN</code>{' '}
          yourself.
        </p>
        <a
          href={authorizeUrl()}
          data-testid="spotify-connect-link"
          class="inline-block rounded-full bg-[var(--blue-deep)] px-5 py-2.5 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
        >
          Connect Spotify
        </a>
      </div>
    </main>
  )
}

export default function SpotifySyncPage() {
  const { isAuthenticated } = useAuth()
  return (
    <>
      <Title>{`Spotify Sync | ${SITE_TITLE}`}</Title>
      <Meta name="robots" content="noindex" />
      <Show when={isAuthenticated()} fallback={<NotFound />}>
        <SyncContent />
      </Show>
    </>
  )
}
