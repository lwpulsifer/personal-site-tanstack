import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { SITE_TITLE } from '#/lib/site'
import type { SpotifyTokenExchangeResult } from '#/lib/spotify'
import { getServerUser } from '#/server/auth'
import { exchangeCode } from '#/server/spotify'

const pageTitle = `Spotify Sync | ${SITE_TITLE}`

const SearchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute('/spotifycallback')({
  // Admin-only, hidden behind a 404 — this displays a live Spotify refresh
  // token, so only the site owner should ever be able to reach it.
  beforeLoad: async () => {
    const user = await getServerUser()
    if (!user) throw notFound()
  },
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => ({ code: search.code, error: search.error }),
  loader: async ({ deps }): Promise<SpotifyTokenExchangeResult> => {
    if (deps.error) {
      return { ok: false, error: deps.error }
    }
    if (!deps.code) {
      return { ok: false, error: 'missing_code' }
    }
    return exchangeCode({ data: { code: deps.code } })
  },
  head: () => ({
    meta: [{ title: pageTitle }, { name: 'robots', content: 'noindex' }],
  }),
  component: SpotifyCallbackPage,
})

function SpotifyCallbackPage() {
  const result = Route.useLoaderData()

  return (
    <main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div className="island-shell rise-in w-full max-w-lg rounded-[2rem] px-8 py-10 text-center">
        <p className="island-kicker mb-3">Admin</p>

        {result.ok ? (
          <>
            <h1 className="display-title mb-4 text-2xl font-bold text-[var(--text)]">
              New refresh token
            </h1>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              Copy this into <code>SPOTIFY_REFRESH_TOKEN</code> wherever your
              env vars are set (locally and in production), then redeploy. This
              isn't stored anywhere — it only exists here.
            </p>
            <textarea
              readOnly
              value={result.refreshToken}
              data-testid="spotify-refresh-token"
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </>
        ) : (
          <>
            <h1 className="display-title mb-4 text-2xl font-bold text-[var(--text)]">
              Couldn't connect
            </h1>
            <p
              data-testid="spotify-callback-error"
              className="text-sm text-red-600 dark:text-red-400"
            >
              {result.error}
              {result.errorDescription ? ` — ${result.errorDescription}` : ''}
            </p>
          </>
        )}
      </div>
    </main>
  )
}
