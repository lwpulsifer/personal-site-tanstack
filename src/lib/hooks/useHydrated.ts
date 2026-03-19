import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

/**
 * Returns `false` during SSR and hydration, `true` once the client has hydrated.
 * Drop-in replacement for the `useState(false) + useEffect(() => set(true), [])` pattern.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}
