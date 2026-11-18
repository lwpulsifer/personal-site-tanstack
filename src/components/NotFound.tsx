import { paths } from '../router'

export function NotFound() {
  return (
    <main class="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div class="island-shell rise-in w-full max-w-sm rounded-[2rem] px-8 py-10 text-center">
        <p class="island-kicker mb-3">404</p>
        <h1
          data-testid="not-found-heading"
          class="display-title mb-4 text-2xl font-bold text-[var(--text)]"
        >
          Page not found
        </h1>
        <p class="mb-8 text-sm text-[var(--text-muted)]">There's nothing here.</p>
        <a
          href={paths()}
          class="rounded-full border border-[rgba(37,99,235,0.3)] bg-[rgba(59,130,246,0.1)] px-5 py-2.5 text-sm font-semibold text-[var(--blue-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(59,130,246,0.18)]"
        >
          Back to home
        </a>
      </div>
    </main>
  )
}
