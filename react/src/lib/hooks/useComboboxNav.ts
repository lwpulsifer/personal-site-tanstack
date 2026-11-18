import { useEffect, useId, useRef, useState } from 'react'

export interface UseComboboxNavOptions {
  /** How many options the open listbox currently has. */
  resultCount: number
  /** Called when Enter commits the highlighted option. */
  onCommit: (index: number) => void
  /** Called after Escape closes the dropdown. */
  onEscape?: () => void
  /** Called after a click outside the combobox closes the dropdown. */
  onOutsideClose?: () => void
}

export interface UseComboboxNav {
  /** Attach to the combobox's root element so outside clicks can be detected. */
  containerRef: React.RefObject<HTMLDivElement | null>
  listboxId: string
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  activeIndex: number
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>
  handleKeyDown: (e: React.KeyboardEvent) => void
}

/**
 * Shared open/close, arrow-key, and outside-click behavior for a
 * search-as-you-type combobox (an input paired with a filtered listbox of
 * options), so each combobox only has to supply its own filtering/rendering.
 */
export function useComboboxNav({
  resultCount,
  onCommit,
  onEscape,
  onOutsideClose,
}: UseComboboxNavOptions): UseComboboxNav {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  // Read the latest callbacks via a ref so callers can pass inline closures
  // without this hook needing to resubscribe its listeners every render.
  const callbacksRef = useRef({ onCommit, onEscape, onOutsideClose })
  callbacksRef.current = { onCommit, onEscape, onOutsideClose }

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        callbacksRef.current.onOutsideClose?.()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((i) => {
        if (resultCount === 0) return -1
        const next = i + delta
        if (next < 0) return resultCount - 1
        if (next >= resultCount) return 0
        return next
      })
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && activeIndex < resultCount) {
        e.preventDefault()
        callbacksRef.current.onCommit(activeIndex)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      callbacksRef.current.onEscape?.()
    }
  }

  return {
    containerRef,
    listboxId,
    isOpen,
    setIsOpen,
    activeIndex,
    setActiveIndex,
    handleKeyDown,
  }
}
