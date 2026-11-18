import { useLocation } from '@solidjs/router'
import { createEffect, createMemo, Errored, Loading } from 'solid-js'
import { getPageViews, logPageView } from '../server/pageViews'

/**
 * Converts a pathname to the URL key used in the DB (matches the original
 * site's convention): / → "", /blog → "blog", /blog/foo → "blog|foo".
 */
export function pathToKey(pathname: string) {
  return encodeURI(pathname).split('/').slice(1).join('|')
}

const shouldLog = !import.meta.env.DEV || import.meta.env.VITE_DEBUG_PAGE_VIEWS === 'true'

function ViewCount(props: { urlKey: string }) {
  const count = createMemo(() => getPageViews(props.urlKey))
  return (
    <>
      {count() == null
        ? ' '
        : `${count()!.toLocaleString()} ${count() === 1 ? 'view' : 'views'}`}
    </>
  )
}

export default function PageViewsTracker() {
  const location = useLocation()
  const key = createMemo(() => pathToKey(location.pathname))

  // Logs a page view once per session per unique key.
  createEffect(key, (k) => {
    if (!shouldLog) return
    const storageKey = `pv:${k}`
    try {
      if (sessionStorage.getItem(storageKey) !== null) return
      sessionStorage.setItem(storageKey, '1')
    } catch {
      return
    }
    logPageView(k).catch(() => {})
  })

  return (
    <span class="text-xs text-(--sea-ink-soft) opacity-60">
      <Errored fallback={' '}>
        <Loading fallback={' '}>
          <ViewCount urlKey={key()} />
        </Loading>
      </Errored>
    </span>
  )
}
