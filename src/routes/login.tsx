import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '#/lib/supabase'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Login' }] }),
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = getSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    router.navigate({ to: '/' })
  }

  return (
    <main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div className="island-shell rise-in w-full max-w-sm rounded-[2rem] px-8 py-10">
        <p className="island-kicker mb-3">Admin</p>
        <h1 className="display-title mb-8 text-2xl font-bold text-[var(--text)]">Sign in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-[var(--text-muted)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-[var(--text-muted)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-[var(--blue-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
