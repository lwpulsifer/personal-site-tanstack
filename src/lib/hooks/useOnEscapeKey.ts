import { useEffect } from 'react'

/** Calls `handler` when the Escape key is pressed. */
export function useOnEscapeKey(handler: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handler])
}
