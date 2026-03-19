import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Manages lightbox/modal state: tracks the open index, handles scroll lock,
 * focus trapping (save/restore), and keyboard navigation.
 */
export function useLightbox(itemCount: number) {
  const [index, setIndex] = useState<number | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)

  const open = useCallback((i: number) => setIndex(i), [])
  const close = useCallback(() => setIndex(null), [])
  const prev = useCallback(
    () => setIndex((i) => (i !== null ? Math.max(i - 1, 0) : null)),
    [],
  )
  const next = useCallback(
    () => setIndex((i) => (i !== null ? Math.min(i + 1, itemCount - 1) : null)),
    [itemCount],
  )

  // Focus management + scroll lock
  useEffect(() => {
    if (index === null) return

    // Save the element that triggered the lightbox
    lastActiveElementRef.current = document.activeElement as HTMLElement | null
    overlayRef.current?.focus()

    // Lock body scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevOverflow
      lastActiveElementRef.current?.focus?.()
    }
  }, [index])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    },
    [close, next, prev],
  )

  return {
    index,
    isOpen: index !== null,
    overlayRef,
    open,
    close,
    prev,
    next,
    onKeyDown,
  }
}
