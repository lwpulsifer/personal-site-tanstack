import { createFileRoute } from '@tanstack/react-router'
import { getTopTracks } from '#/server/spotify'
import type { TopTrack } from '#/lib/spotify'
import { SITE_TITLE } from '#/lib/site'

export const Route = createFileRoute('/fun')({
  head: () => ({
    meta: [{ title: `Fun | ${SITE_TITLE}` }],
  }),
  loader: async () => {
    try {
      return await getTopTracks()
    } catch {
      return [] as TopTrack[]
    }
  },
  component: Fun,
})

function Fun() {
  const tracks = Route.useLoaderData()

  // Easter egg: if one artist makes up more than half the list
  const artistCounts: Record<string, number> = {}
  for (const t of tracks) {
    artistCounts[t.artist] = (artistCounts[t.artist] ?? 0) + 1
  }
  const dominantArtist = Object.entries(artistCounts).find(
    ([, count]) => count / tracks.length > 0.5,
  )?.[0]

  return (
    <main className="page-wrap px-4 pb-12 pt-14">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Spotify</p>
        <h1 className="display-title mb-6 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          My Top Tracks
        </h1>

        {tracks.length === 0 ? (
          <p className="text-[var(--sea-ink-soft)]">
            Couldn't load tracks right now — Spotify credentials may not be
            configured.
          </p>
        ) : (
          <>
            <ol className="space-y-2">
              {tracks.map((track, i) => (
                <li
                  key={track.id}
                  className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--lagoon)] hover:shadow-sm"
                >
                  <span className="w-6 shrink-0 text-right text-sm font-semibold text-[var(--sea-ink-soft)]">
                    {i + 1}
                  </span>
                  {track.albumImageUrl && (
                    <img
                      src={track.albumImageUrl}
                      alt={track.album}
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <a
                      href={track.songUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-semibold text-[var(--sea-ink)] no-underline hover:text-[var(--lagoon-deep)]"
                    >
                      {track.title}
                    </a>
                    <p className="m-0 truncate text-sm italic text-[var(--sea-ink-soft)]">
                      {track.artist}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-right text-sm text-[var(--sea-ink-soft)] sm:block">
                    {track.album}
                  </span>
                </li>
              ))}
            </ol>

            {dominantArtist && (
              <p className="mt-6 text-center text-sm text-[var(--sea-ink-soft)]">
                Yeah, I know it's a little embarrassing to have more than half
                my top ten be{' '}
                <span className="italic">{dominantArtist}</span> 🙃
              </p>
            )}
          </>
        )}
      </section>
    </main>
  )
}
