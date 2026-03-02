import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { exchangeStravaCode } from '#/server/strava'

export const Route = createFileRoute('/strava/callback')({
  component: StravaCallbackPage,
})

function StravaCallbackPage() {
  const { mutate, isPending, isSuccess, isError, error, data } = useMutation({
    mutationFn: (code: string) => exchangeStravaCode({ data: { code } }),
  })

  // Pull the OAuth code from the URL and fire the exchange exactly once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error')
    const code = params.get('code')

    if (!oauthError && code) mutate(code)
    // `mutate` is stable across renders in TanStack Query v5.
  }, [mutate])

  const oauthError =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('error')
      : null

  return (
    <main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div className="island-shell w-full max-w-sm rounded-[2rem] px-8 py-10 text-center">
        {(isPending || (!isSuccess && !isError && !oauthError)) && (
          <>
            <p className="island-kicker mb-3">Connecting…</p>
            <p className="text-sm text-[var(--text-muted)]">Exchanging Strava authorization code…</p>
          </>
        )}

        {isSuccess && (
          <>
            <p className="island-kicker mb-3">Done</p>
            <h1 className="display-title mb-3 text-2xl font-bold text-[var(--text)]">
              Strava connected
            </h1>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              {data.athlete ? `Connected as @${data.athlete}` : 'Connected!'}
            </p>
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              Copy the <code className="font-mono">refresh_token</code> from your server logs into{' '}
              <code className="font-mono">STRAVA_REFRESH_TOKEN</code> in your .env file, then
              restart the server.
            </p>
          </>
        )}

        {(isError || oauthError) && (
          <>
            <p className="island-kicker mb-3">Error</p>
            <h1 className="display-title mb-3 text-2xl font-bold text-[var(--text)]">
              Connection failed
            </h1>
            <p className="text-sm text-red-500">
              {oauthError ?? (error instanceof Error ? error.message : 'Failed to exchange code')}
            </p>
          </>
        )}
      </div>
    </main>
  )
}
