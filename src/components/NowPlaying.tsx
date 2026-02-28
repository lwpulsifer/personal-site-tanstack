import { useEffect, useState } from 'react'
import { getNowPlaying } from '#/server/spotify'
import type { NowPlayingData } from '#/lib/spotify'

export default function NowPlaying() {
  const [data, setData] = useState<NowPlayingData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const result = await getNowPlaying()
        if (!cancelled) setData(result)
      } catch {
        // Spotify creds may not be set in dev — fail silently
      }
    }

    poll()
    const id = setInterval(poll, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (!data) return null

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--text-muted)]">
      <img src="/spotify.png" alt="Spotify" className="h-5 w-5 shrink-0" />
      {data.isPlaying ? (
        <a
          href={data.songUrl}
          target="_blank"
          rel="noreferrer"
          className="max-w-[200px] truncate no-underline hover:text-[var(--text)]"
          title={`${data.title} — ${data.artist}`}
        >
          <span className="font-semibold">{data.title}</span>
          <span className="mx-1 opacity-50">—</span>
          <span className="italic">{data.artist}</span>
        </a>
      ) : (
        <span className="opacity-60">Nothing playing</span>
      )}
    </div>
  )
}
