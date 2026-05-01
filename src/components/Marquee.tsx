import { useLayoutEffect, useRef, useState } from 'react'

type MarqueeProps = {
  children: React.ReactNode
  className?: string
}

export default function Marquee({ children, className = '' }: MarqueeProps) {
  const trackRef = useRef<HTMLSpanElement>(null)
  const maskRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const mask = maskRef.current
    const track = trackRef.current
    if (!mask || !track) return

    const check = () => setOverflows(track.scrollWidth > mask.clientWidth)
    check()

    const observer = new ResizeObserver(check)
    observer.observe(mask)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={maskRef} className={`overflow-hidden ${className}`}>
      <span
        ref={trackRef}
        className={overflows ? 'marquee' : 'block truncate'}
      >
        {children}
        {overflows && (
          <>
            <span className="mx-4 opacity-20">·</span>
            {children}
          </>
        )}
      </span>
    </div>
  )
}
