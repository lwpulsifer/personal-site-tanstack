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

export default function PageViewsTracker() {
  const { pathname } = useLocation()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const key = pathToKey(pathname)

    // Fire-and-forget: log the view, then fetch the updated count
    logPageView({ data: { url: key } })
      .then(() => getPageViews({ data: { url: key } }))
      .then(setCount)
      .catch(() => {
        // Supabase creds not set or network error — fail silently
      })
  }, [pathname])

  return (
    <span className="text-xs text-[var(--sea-ink-soft)] opacity-60">
      {count === null ? '\u00A0' : `${count.toLocaleString()} ${count === 1 ? 'view' : 'views'}`}
    </span>
  )
}
