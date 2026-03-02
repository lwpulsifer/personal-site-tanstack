import { useQuery } from '@tanstack/react-query'
import { nowPlayingQueryOptions } from '#/lib/queries'
import Marquee from './Marquee'

export default function NowPlaying() {
  const { data } = useQuery(nowPlayingQueryOptions)

  if (!data) return null

  return (
    <div className="flex max-w-[500px] items-center gap-2 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--text-muted)]">
      <img src="/spotify.png" alt="Spotify" className="h-5 w-5 shrink-0" />
      {data.isPlaying ? (
        <a
          href={data.songUrl}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 no-underline hover:text-[var(--text)]"
          title={`${data.title} — ${data.artist}`}
        >
          <Marquee>
            <span className="font-semibold">{data.title}</span>
            <span className="mx-1 opacity-50">—</span>
            <span className="italic">{data.artist}</span>
          </Marquee>
        </a>
      ) : (
        <span className="opacity-60">Nothing playing</span>
      )}
    </div>
  )
}
