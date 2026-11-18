import type { JSX } from '@solidjs/web'
import { createSignal, onSettled, Show } from 'solid-js'

export default function Marquee(props: { children: JSX.Element; class?: string }) {
  let track!: HTMLSpanElement
  let mask!: HTMLDivElement
  const [overflows, setOverflows] = createSignal(false)

  onSettled(() => {
    const check = () => setOverflows(track.scrollWidth > mask.clientWidth)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(mask)
    return () => observer.disconnect()
  })

  return (
    <div ref={mask} class={`overflow-hidden ${props.class ?? ''}`}>
      <span ref={track} class={overflows() ? 'marquee' : 'block truncate'}>
        {props.children}
        <Show when={overflows()}>
          <span class="mx-4 opacity-20">·</span>
          {props.children}
        </Show>
      </span>
    </div>
  )
}
