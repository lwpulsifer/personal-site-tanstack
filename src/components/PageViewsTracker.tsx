import { useEffect, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { logPageView, getPageViews } from '#/server/pageViews'

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
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const key = pathToKey(pathname)

    if (shouldLog) {
      const storageKey = `pv:${key}`

      // Set the flag synchronously before the async call so that React
      // StrictMode's second effect invocation (and genuine same-session
      // return visits) find it already set and skip logging.
      const alreadyLogged = sessionStorage.getItem(storageKey) !== null
      if (!alreadyLogged) {
        sessionStorage.setItem(storageKey, '1')
        logPageView({ data: { url: key } }).catch(() => {})
      }
    }

    getPageViews({ data: { url: key } })
      .then(setCount)
      .catch(() => {})
  }, [pathname])

  return (
    <span className="text-xs text-(--sea-ink-soft) opacity-60">
      {count === null
        ? '\u00A0'
        : `${count.toLocaleString()} ${count === 1 ? 'view' : 'views'}`}
    </span>
  )
}
