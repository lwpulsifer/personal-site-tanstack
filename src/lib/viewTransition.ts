import { useLocation, useNavigate } from '@solidjs/router'
import { createEffect, createRoot, flush } from 'solid-js'

// How long we'll wait for the router to commit before giving up and letting the
// browser finish the transition anyway (browsers abort after ~4s regardless).
const COMMIT_TIMEOUT_MS = 3000

function canViewTransition() {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Navigation wrapped in the browser's View Transitions API — what TanStack
 * Router's `viewTransition` option does. Solid's router has no such option, and
 * it also *holds* the old page until the next route's data has settled, so the
 * transition callback must stay pending until the new route has actually
 * committed; otherwise the browser would snapshot the old page as the "after".
 *
 * Falls back to a plain navigation where the API is missing or the user prefers
 * reduced motion. Call during component setup (it reads router context).
 */
export function useViewTransitionNavigate() {
  const navigate = useNavigate()
  const location = useLocation()

  return (to: string) => {
    if (!canViewTransition()) return navigate(to)

    const from = location.pathname
    document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          let done = false
          let dispose: () => void = () => {}
          const finish = () => {
            if (done) return
            done = true
            dispose()
            // Don't wait for a frame here: while the transition callback is pending
            // the browser suppresses rendering, so requestAnimationFrame never fires
            // (it would just stall until the timeout). Apply any batched updates so
            // the new DOM is final, then let the browser take the "after" snapshot.
            flush()
            resolve()
          }
          dispose = createRoot((d) => {
            // The effect's first run sees the current path; any later change means
            // the router committed the new route (and its DOM).
            createEffect(
              () => location.pathname,
              (pathname) => {
                if (pathname !== from) finish()
              },
            )
            return d
          })
          setTimeout(finish, COMMIT_TIMEOUT_MS)
          navigate(to)
        }),
    )
  }
}

/**
 * Click handler for an `<a href>` that should navigate with a view transition
 * (TanStack's `<Link viewTransition>`). Leaves modified clicks (new tab, etc.)
 * to the browser and ordinary clicks to the router's own link handling.
 */
export function viewTransitionClick(
  navigateWithTransition: (to: string) => void,
  href: () => string,
) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const anchor = e.currentTarget as HTMLAnchorElement
    if (anchor.target && anchor.target !== '_self') return
    e.preventDefault()
    navigateWithTransition(href())
  }
}
