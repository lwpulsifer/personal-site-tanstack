import { createSignal, createUniqueId, onSettled } from 'solid-js'

export interface ComboboxNavOptions {
  /** How many options the open listbox currently has. */
  resultCount: () => number
  /** Called when Enter commits the highlighted option. */
  onCommit: (index: number) => void
  onEscape?: () => void
  onOutsideClose?: () => void
}

/**
 * Shared open/close, arrow-key, and outside-click behavior for a
 * search-as-you-type combobox. Solid port of useComboboxNav: signals replace
 * state, and no callback ref is needed because closures never go stale.
 */
export function createComboboxNav(opts: ComboboxNavOptions) {
  const [isOpen, setIsOpen] = createSignal(false)
  const [activeIndex, setActiveIndex] = createSignal(-1)
  const listboxId = createUniqueId()
  let container: HTMLDivElement | undefined

  onSettled(() => {
    const onDown = (e: MouseEvent) => {
      if (!isOpen()) return
      if (container && !container.contains(e.target as Node)) {
        setIsOpen(false)
        opts.onOutsideClose?.()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  })

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen()) {
        setIsOpen(true)
        return
      }
      const count = opts.resultCount()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      if (count === 0) return setActiveIndex(-1)
      const next = activeIndex() + delta
      setActiveIndex(next < 0 ? count - 1 : next >= count ? 0 : next)
    } else if (e.key === 'Enter') {
      if (isOpen() && activeIndex() >= 0 && activeIndex() < opts.resultCount()) {
        e.preventDefault()
        opts.onCommit(activeIndex())
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      opts.onEscape?.()
    }
  }

  return {
    /** Pass as `ref={nav.setContainer}` on the combobox root. */
    setContainer: (el: HTMLDivElement) => {
      container = el
    },
    listboxId,
    isOpen,
    setIsOpen,
    activeIndex,
    setActiveIndex,
    handleKeyDown,
  }
}
