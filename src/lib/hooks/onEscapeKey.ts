import { onSettled } from 'solid-js'

/** Calls `handler` when Escape is pressed, for the lifetime of the component. */
export function onEscapeKey(handler: () => void) {
  onSettled(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
