import { createFileRoute, Link } from '@tanstack/react-router'
import { serverSignOut } from '#/server/auth'

export const Route = createFileRoute('/logout')({
  head: () => ({ meta: [{ title: 'Signed out' }] }),
  beforeLoad: async () => {
    await serverSignOut()
  },
  component: LogoutPage,
})

function LogoutPage() {
  return (
    <main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div className="island-shell rise-in w-full max-w-sm rounded-[2rem] px-8 py-10 text-center">
        <p className="island-kicker mb-3">See you later</p>
        <h1
          data-testid="signed-out-msg"
          className="display-title mb-4 text-2xl font-bold text-[var(--text)]"
        >
          You're signed out
        </h1>
        <p className="mb-8 text-sm text-[var(--text-muted)]">
          Come back any time.
        </p>
        <Link
          to="/"
          className="rounded-full border border-[rgba(37,99,235,0.3)] bg-[rgba(59,130,246,0.1)] px-5 py-2.5 text-sm font-semibold text-[var(--blue-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(59,130,246,0.18)]"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
