import { useEffect } from 'react'
import { logPageView } from '#/server/pageViews'

const shouldLog =
  !import.meta.env.DEV || import.meta.env.VITE_DEBUG_PAGE_VIEWS === 'true'

/** Logs a page view once per session per unique key. */
export function useLogPageView(key: string) {
  useEffect(() => {
    if (!shouldLog) return
    const storageKey = `pv:${key}`
    if (sessionStorage.getItem(storageKey) !== null) return
    sessionStorage.setItem(storageKey, '1')
    logPageView({ data: { url: key } }).catch(() => {})
  }, [key])
}
