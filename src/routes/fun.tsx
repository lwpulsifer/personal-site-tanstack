import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
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
        <p className="island-kicker mb-2">Fun</p>
        <h1 className="display-title mb-6 text-4xl font-bold text-[var(--text)] sm:text-5xl">
          Misc. Good Stuff
        </h1>

        <div className="space-y-3">
          <Link
            to="/lions"
            className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 no-underline transition hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                Map
              </p>
              <h2 className="mt-2 text-lg font-bold text-[var(--text)]">
                Lions of SF <span aria-hidden>🦁</span>
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Explore lion statues across San Francisco and report sightings.
              </p>
              <p className="mt-4 text-sm font-semibold text-[var(--blue-deep)] group-hover:text-[var(--blue-darker)]">
                Open map -&gt;
              </p>
            </div>
              <div
                aria-hidden
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface),var(--text)_2%)] text-2xl"
              >
                🦁
              </div>
            </div>
          </Link>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Spotify
            </p>
            <h2 className="mt-2 text-lg font-bold text-[var(--text)]">
              My Top Tracks
            </h2>

            {tracks.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Couldn't load tracks right now — Spotify credentials may not be configured.
              </p>
            ) : (
              <ol className="mt-4 space-y-2">
                {tracks.map((track, i) => (
                  <li
                    key={track.id}
                    className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface),var(--text)_2%)] px-4 py-3 transition hover:border-[var(--blue)]"
                  >
                    <span className="w-6 shrink-0 text-right text-sm font-semibold text-[var(--text-muted)]">
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
                        className="block truncate font-semibold text-[var(--text)] no-underline hover:text-[var(--blue-deep)]"
                      >
                        {track.title}
                      </a>
                      <p className="m-0 truncate text-sm italic text-[var(--text-muted)]">
                        {track.artist}
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-right text-sm text-[var(--text-muted)] sm:block">
                      {track.album}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {dominantArtist && tracks.length > 0 && (
          <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
            Yeah, I know it's a little embarrassing to have more than half my top ten be{' '}
            <span className="italic">{dominantArtist}</span>.
          </p>
        )}
      </section>
    </main>
  )
}
