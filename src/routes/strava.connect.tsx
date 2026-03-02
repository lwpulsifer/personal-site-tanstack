import { createFileRoute, redirect } from '@tanstack/react-router'
import { getServerUser } from '#/server/auth'

export const Route = createFileRoute('/strava/connect')({
  loader: async () => {
    const user = await getServerUser()
    if (!user) throw redirect({ to: '/login' })
    return {}
  },
  component: StravaConnectPage,
})

function StravaConnectPage() {
  // Build the OAuth URL client-side so we can use window.location.origin
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined

  if (!clientId) {
    return (
      <main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
        <div className="island-shell w-full max-w-sm rounded-[2rem] px-8 py-10 text-center">
          <p className="text-sm text-red-500">
            VITE_STRAVA_CLIENT_ID is not set. Add it to your .env file.
          </p>
        </div>
      </main>
    )
  }

  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/strava/callback`
      : 'http://localhost:3000/strava/callback'

  const authUrl = new URL('https://www.strava.com/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'activity:read_all')

  return (
    <main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div className="island-shell w-full max-w-sm rounded-[2rem] px-8 py-10 text-center">
        <p className="island-kicker mb-3">One-time setup</p>
        <h1 className="display-title mb-3 text-2xl font-bold text-[var(--text)]">
          Connect Strava
        </h1>
        <p className="mb-8 text-sm text-[var(--text-muted)]">
          Authorize Strava to match recorded activities with planned workouts. After connecting,
          copy the <code className="font-mono text-xs">refresh_token</code> from the server logs to{' '}
          <code className="font-mono text-xs">STRAVA_REFRESH_TOKEN</code> in your .env file.
        </p>
        <a
          href={authUrl.toString()}
          className="inline-block rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-orange-600"
        >
          Connect with Strava
        </a>
      </div>
    </main>
  )
}
