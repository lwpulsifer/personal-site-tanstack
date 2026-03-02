import { useEffect } from 'react'

/** Calls `callback` when the Escape key is pressed. */
export function useEscapeKey(callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') callback()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [callback])
}
