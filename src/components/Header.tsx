import { Show } from 'solid-js'
import { useAuth } from '../lib/auth'
import { paths } from '../router'
import NowPlaying from './NowPlaying'

export default function Header() {
  const { isAuthenticated } = useAuth()

  return (
    <header class="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav class="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 class="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <a
            href={paths()}
            class={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold no-underline shadow-[0_8px_24px_rgba(17,24,39,0.08)] transition-colors ${
              isAuthenticated()
                ? 'border-green-500/40 bg-green-500/20 text-green-700 dark:text-green-400'
                : 'border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--text)]'
            }`}
          >
            LP
          </a>
        </h2>

        <div class="ml-auto hidden sm:flex sm:items-center">
          <NowPlaying />
        </div>

        <div class="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:flex-nowrap sm:pb-0">
          <a href={paths()} class="nav-link">Home</a>
          <a href={paths.blog()} class="nav-link">Blog</a>
          <a href={paths.books()} class="nav-link">Books</a>
          <a href={paths.fun()} class="nav-link">Fun</a>
          <Show when={isAuthenticated()}>
            <a href={paths.people()} class="nav-link">People</a>
          </Show>
        </div>
      </nav>
    </header>
  )
}
