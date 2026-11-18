import { Meta, Title } from '@solidjs/meta'
import { query, type RouteDefinition, useSearchParams } from '@solidjs/router'
import { httpStatus } from '@solidjs/web'
import { createMemo, Show } from 'solid-js'
import { NotFound } from '../components/NotFound'
import { useAuth } from '../lib/auth'
import { SITE_TITLE } from '../lib/site'
import { getServerUser } from '../server/auth'
import { exchangeCode } from '../server/spotify'
import type { SpotifyTokenExchangeResult } from '../lib/spotify'

// Admin-only, hidden behind a 404 — this displays a live Spotify refresh
// token, so only the site owner should ever be able to reach it.
export const route = {
  preload: async () => {
    if (!(await getServerUser())) httpStatus(404)
  },
} satisfies RouteDefinition

// Exchanging a code is a one-shot, so run it as a keyed query (cached per code).
const getTokenResult = query(
  async (code: string | undefined, error: string | undefined): Promise<SpotifyTokenExchangeResult> => {
    if (error) return { ok: false, error }
    if (!code) return { ok: false, error: 'missing_code' }
    return exchangeCode(code)
  },
  'spotify-token-result',
)

function CallbackContent() {
  const [search] = useSearchParams()
  const result = createMemo(() =>
    getTokenResult(search.code as string | undefined, search.error as string | undefined),
  )

  return (
    <main class="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div class="island-shell rise-in w-full max-w-lg rounded-[2rem] px-8 py-10 text-center">
        <p class="island-kicker mb-3">Admin</p>
        <Show
          when={result().ok}
          fallback={
            <>
              <h1 class="display-title mb-4 text-2xl font-bold text-[var(--text)]">
                Couldn't connect
              </h1>
              <p data-testid="spotify-callback-error" class="text-sm text-red-600 dark:text-red-400">
                {(result() as { error: string }).error}
                {(result() as { errorDescription?: string }).errorDescription
                  ? ` — ${(result() as { errorDescription?: string }).errorDescription}`
                  : ''}
              </p>
            </>
          }
        >
          <h1 class="display-title mb-4 text-2xl font-bold text-[var(--text)]">New refresh token</h1>
          <p class="mb-4 text-sm text-[var(--text-muted)]">
            Copy this into <code>SPOTIFY_REFRESH_TOKEN</code> wherever your env vars are set
            (locally and in production), then redeploy. This isn't stored anywhere — it only exists
            here.
          </p>
          <textarea
            readonly
            value={(result() as { refreshToken: string }).refreshToken}
            data-testid="spotify-refresh-token"
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            class="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--blue)]"
          />
        </Show>
      </div>
    </main>
  )
}

export default function SpotifyCallbackPage() {
  const { isAuthenticated } = useAuth()
  return (
    <>
      <Title>{`Spotify Sync | ${SITE_TITLE}`}</Title>
      <Meta name="robots" content="noindex" />
      <Show when={isAuthenticated()} fallback={<NotFound />}>
        <CallbackContent />
      </Show>
    </>
  )
}
