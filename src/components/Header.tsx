import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { PendingCommentsPanel } from '#/components/books/PendingCommentsPanel'
import { useAuth } from '#/lib/auth'
import { pendingCommentsQueryOptions } from '#/lib/queries'
import NowPlaying from './NowPlaying'

export default function Header() {
  const { isAuthenticated } = useAuth()
  const [panelOpen, setPanelOpen] = useState(false)
  const { data: pending } = useQuery({
    ...pendingCommentsQueryOptions,
    enabled: isAuthenticated,
  })
  const pendingCount = pending?.length ?? 0

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 className="relative m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold no-underline shadow-[0_8px_24px_rgba(17,24,39,0.08)] transition-colors ${
              isAuthenticated
                ? 'border-green-500/40 bg-green-500/20 text-green-700 dark:text-green-400'
                : 'border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--text)]'
            }`}
          >
            LP
          </Link>

          {isAuthenticated && pendingCount > 0 && (
            <button
              type="button"
              data-testid="pending-comments-badge"
              onClick={() => setPanelOpen((open) => !open)}
              aria-label={`${pendingCount} comment${pendingCount === 1 ? '' : 's'} awaiting approval`}
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--header-bg)]"
            >
              {pendingCount}
            </button>
          )}

          {panelOpen && (
            <PendingCommentsPanel onClose={() => setPanelOpen(false)} />
          )}
        </h2>

        <div className="ml-auto hidden sm:flex sm:items-center">
          <NowPlaying />
        </div>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:flex-nowrap sm:pb-0">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>
          <Link
            to="/blog"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Blog
          </Link>
          {/* <Link
            to="/about"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            About
          </Link> */}
          <Link
            to="/books"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Books
          </Link>
          <Link
            to="/fun"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Fun
          </Link>
          {isAuthenticated && (
            <Link
              to="/people"
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
            >
              People
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
