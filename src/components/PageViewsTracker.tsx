import { useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { logPageView } from '#/server/pageViews'
import { pageViewsQueryOptions } from '#/lib/queries'

/**
 * Converts a pathname to the URL key used in the DB.
 * Matches the original site's convention:
 *   /           → ""
 *   /blog       → "blog"
 *   /blog/foo   → "blog|foo"
 */
function pathToKey(pathname: string) {
  return encodeURI(pathname).split('/').slice(1).join('|')
}

const shouldLog =
  !import.meta.env.DEV || import.meta.env.VITE_DEBUG_PAGE_VIEWS === 'true'

export default function PageViewsTracker() {
  const { pathname } = useLocation()
  const key = pathToKey(pathname)

  // Side effect: log the view once per session per path.
  // This stays in useEffect because it's a fire-and-forget write, not a query.
  useEffect(() => {
    if (!shouldLog) return
    const storageKey = `pv:${key}`
    if (sessionStorage.getItem(storageKey) !== null) return
    sessionStorage.setItem(storageKey, '1')
    logPageView({ data: { url: key } }).catch(() => {})
  }, [key])

  const { data: count } = useQuery(pageViewsQueryOptions(key))

  return (
    <span className="text-xs text-(--sea-ink-soft) opacity-60">
      {count == null
        ? '\u00A0'
        : `${count.toLocaleString()} ${count === 1 ? 'view' : 'views'}`}
    </span>
  )
}
