import { Title } from '@solidjs/meta'
import type { RouteDefinition } from '@solidjs/router'
import { onSettled } from 'solid-js'
import { getSupabaseBrowserClient } from '../lib/supabase'
import { paths } from '../router'
import { serverSignOut } from '../server/auth'

// Runs before render (and on SSR before the response head flushes), so the
// cleared cookie rides the response like the React app's beforeLoad did.
export const route = {
  preload: () => serverSignOut(),
} satisfies RouteDefinition

export default function LogoutPage() {
  // Also drop the in-memory browser session so client-side nav doesn't keep
  // showing admin UI until the next full reload.
  onSettled(() => {
    void getSupabaseBrowserClient().auth.signOut()
  })

  return (
    <main class="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <Title>Signed out</Title>
      <div class="island-shell rise-in w-full max-w-sm rounded-[2rem] px-8 py-10 text-center">
        <p class="island-kicker mb-3">See you later</p>
        <h1
          data-testid="signed-out-msg"
          class="display-title mb-4 text-2xl font-bold text-[var(--text)]"
        >
          You're signed out
        </h1>
        <p class="mb-8 text-sm text-[var(--text-muted)]">Come back any time.</p>
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
