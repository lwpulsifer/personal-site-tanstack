import { useLocation } from '@solidjs/router'
import { isPending, latest } from 'solid-js'

/**
 * Optimistic navigation state. Solid's router *holds* the old page on screen until
 * the next route's data has settled, so by default a click on a nav link shows
 * nothing for as long as that takes. The router doesn't expose where a navigation
 * is heading, but Solid does: `isPending` says a location change is in flight and
 * `latest` peeks at its value. Reading them lets the UI react on the click itself.
 *
 * Call during component setup (it reads router context).
 */
export function useNavigationState() {
  const location = useLocation()

  /** The pathname being navigated to, or undefined when no navigation is in flight. */
  const target = () =>
    isPending(() => location.pathname) ? latest(() => location.pathname) : undefined

  return {
    /** True from the click until the next route has committed. */
    isRouting: () => target() !== undefined,
    /** Where we are, optimistically: the destination while navigating, else the current path. */
    activePath: () => target() ?? location.pathname,
  }
}

/** Whether a nav link to `href` should look active at `pathname` (Home matches exactly). */
export function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
