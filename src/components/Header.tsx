import { For, Show } from 'solid-js'
import { useAuth } from '../lib/auth'
import { isActivePath, useNavigationState } from '../lib/navigation'
import { paths } from '../router'
import NowPlaying from './NowPlaying'

const NAV_LINKS = [
  { label: 'Home', testId: 'nav-home', href: () => String(paths()) },
  { label: 'Blog', testId: 'nav-blog', href: () => String(paths.blog()) },
  { label: 'Books', testId: 'nav-books', href: () => String(paths.books()) },
  { label: 'Fun', testId: 'nav-fun', href: () => String(paths.fun()) },
]

function NavLink(props: { href: string; testId: string; active: boolean; children: string }) {
  return (
    <a
      href={props.href}
      data-testid={props.testId}
      class={`nav-link ${props.active ? 'is-active' : ''}`}
      aria-current={props.active ? 'page' : undefined}
    >
      {props.children}
    </a>
  )
}

export default function Header() {
  const { isAuthenticated } = useAuth()
  const nav = useNavigationState()

  // Active state follows the destination *during* a navigation, so the clicked
  // link responds on the click itself instead of after the next route's data arrives.
  const isActive = (href: string) => isActivePath(nav.activePath(), href)

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
          <For each={NAV_LINKS}>
            {(link) => (
              <NavLink href={link.href()} testId={link.testId} active={isActive(link.href())}>
                {link.label}
              </NavLink>
            )}
          </For>
          <Show when={isAuthenticated()}>
            <NavLink
              href={String(paths.people())}
              testId="nav-people"
              active={isActive(String(paths.people()))}
            >
              People
            </NavLink>
          </Show>
        </div>
      </nav>

      {/* Indeterminate bar while a navigation is in flight (see .route-progress). */}
      <Show when={nav.isRouting()}>
        <div role="progressbar" aria-label="Loading page" data-testid="nav-progress" class="route-progress" />
      </Show>
    </header>
  )
}
