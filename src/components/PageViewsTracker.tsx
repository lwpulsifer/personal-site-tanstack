import { useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { pageViewsQueryOptions } from '#/lib/queries'
import { useLogPageView } from '#/lib/hooks/useLogPageView'

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
  const key = pathToKey(pathname)

  useLogPageView(key)

  const { data: count } = useQuery(pageViewsQueryOptions(key))

  return (
    <span className="text-xs text-(--sea-ink-soft) opacity-60">
      {count == null
        ? '\u00A0'
        : `${count.toLocaleString()} ${count === 1 ? 'view' : 'views'}`}
    </span>
  )
}
