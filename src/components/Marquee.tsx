import { useEffect, useRef, useState } from 'react'

type MarqueeProps = {
  children: React.ReactNode
  className?: string
}

export default function Marquee({ children, className = '' }: MarqueeProps) {
  const trackRef = useRef<HTMLSpanElement>(null)
  const maskRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    if (trackRef.current && maskRef.current) {
      setOverflows(trackRef.current.scrollWidth > maskRef.current.clientWidth)
    }
  }, [children])

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
