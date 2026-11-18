import { useRef, useState } from 'react'

/**
 * Tracks a debounced copy of a fast-changing value (e.g. an input's live
 * text) without re-rendering on every keystroke. Call the returned `update`
 * function from the input's onChange handler; the debounced value updates
 * `delayMs` after the last call.
 */
export function useDebouncedValue<T>(delayMs: number, initial: T) {
  const [debounced, setDebounced] = useState(initial)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function update(value: T) {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebounced(value), delayMs)
  }

  return [debounced, update] as const
}
