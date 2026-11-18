import { revalidate } from '@solidjs/router'
import { createMemo, Errored, onSettled, Show } from 'solid-js'
import { getNowPlaying } from '../server/spotify'
import Marquee from './Marquee'

function NowPlayingInner() {
  const data = createMemo(() => getNowPlaying())

  // Poll every 30s (React Query's refetchInterval).
  onSettled(() => {
    const t = setInterval(() => revalidate(getNowPlaying.key), 30_000)
    return () => clearInterval(t)
  })

  return (
    <div class="flex max-w-[500px] items-center gap-2 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--text-muted)]">
      <img src="/spotify.png" alt="Spotify" width={40} height={40} class="h-5 w-5 shrink-0" />
      <Show when={data().isPlaying} fallback={<span class="opacity-60">Nothing playing</span>}>
        {/* Only the playing variant carries title/artist. */}
        <a
          href={(data() as { songUrl: string }).songUrl}
          target="_blank"
          rel="noreferrer"
          class="min-w-0 flex-1 no-underline hover:text-[var(--text)]"
          title={`${(data() as { title: string }).title} — ${(data() as { artist: string }).artist}`}
        >
          <Marquee>
            <span class="font-semibold">{(data() as { title: string }).title}</span>
            <span class="mx-1 opacity-50">—</span>
            <span class="italic">{(data() as { artist: string }).artist}</span>
          </Marquee>
        </a>
      </Show>
    </div>
  )
}

export default function NowPlaying() {
  // A failed fetch renders nothing (React Query: retry false, no data => null).
  return (
    <Errored fallback={null}>
      <NowPlayingInner />
    </Errored>
  )
}
