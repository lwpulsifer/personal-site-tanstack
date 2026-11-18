import { createSignal, onCleanup } from 'solid-js'

/**
 * A debounced copy of a fast-changing value. Call `update(value)` from the
 * input handler; the returned accessor changes `delayMs` after the last call.
 * (The value is boxed so a function-typed T isn't mistaken for a derived signal.)
 */
export function createDebounced<T>(delayMs: number, initial: T) {
  const [box, setBox] = createSignal({ value: initial })
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))
  function update(value: T) {
    clearTimeout(timer)
    timer = setTimeout(() => setBox({ value }), delayMs)
  }
  return [() => box().value, update] as const
}
