import { createEffect, createSignal } from 'solid-js'

export type LookupStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error'

/**
 * Abortable fetch keyed on a reactive value, reduced to the
 * idle/loading/found/not-found/error shape the book editor shows. Replaces the
 * React app's useQuery + deriveLookupStatus. `key` returning null means
 * "disabled".
 */
export function createLookup<T>(opts: {
  key: () => string | null
  fetcher: (key: string, signal: AbortSignal) => Promise<T>
  hasResult: (data: T) => boolean
}) {
  const [status, setStatus] = createSignal<LookupStatus>('idle')
  const [data, setData] = createSignal<T | undefined>(undefined)

  createEffect(opts.key, (key) => {
    if (key === null) {
      setStatus('idle')
      setData(() => undefined)
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    opts
      .fetcher(key, controller.signal)
      .then((result) => {
        setData(() => result)
        setStatus(opts.hasResult(result) ? 'found' : 'not-found')
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setData(() => undefined)
        setStatus('error')
        console.error(err)
      })
    // Cleanup: a newer key (or unmount) aborts the in-flight request.
    return () => controller.abort()
  })

  return { status, data }
}
