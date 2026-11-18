import { Title } from '@solidjs/meta'
import type { RouteDefinition } from '@solidjs/router'
import { createMemo, For, Show } from 'solid-js'
import { getTopTracks } from '../lib/tracks'
import { findDominantArtist } from '../lib/tracks-utils'

// Starts the fetch as navigation begins (hover/focus preload).
export const route = {
  preload: () => {
    void getTopTracks()
  },
} satisfies RouteDefinition

export default function Fun() {
  // Async lives in the reactive graph: a memo returning a Promise is "pending"
  // until it lands, and the <Loading> boundary in App.tsx covers it. No
  // loader/useLoaderData split, no isLoading branching here.
  const tracks = createMemo(() => getTopTracks())
  const dominantArtist = createMemo(() => findDominantArtist(tracks()))

  return (
    <main class="page-wrap px-4 pb-12 pt-14">
      <Title>Fun | Liam Pulsifer</Title>
      <section class="island-shell rounded-2xl p-6 sm:p-8">
        <p class="island-kicker mb-2">Fun</p>
        <h1 class="display-title mb-6 text-4xl font-bold text-[var(--text)] sm:text-5xl">
          Misc. Good Stuff
        </h1>

        <div class="space-y-3">
          <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p class="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Spotify
            </p>
            <h2 class="mt-2 text-lg font-bold text-[var(--text)]">My Top Tracks</h2>

            <Show
              when={tracks().length > 0}
              fallback={
                <p data-testid="tracks-empty" class="mt-3 text-sm text-[var(--text-muted)]">
                  Couldn't load tracks right now — Spotify credentials may not be configured.
                </p>
              }
            >
              <ol data-testid="tracks-list" class="mt-4 space-y-2">
                {/* Default (keyed) For: raw item, index is an accessor. */}
                <For each={tracks()}>
                  {(track, i) => (
                    <li
                      data-testid="track-item"
                      class="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface),var(--text)_2%)] px-4 py-3 transition hover:border-[var(--blue)]"
                    >
                      <span class="w-6 shrink-0 text-right text-sm font-semibold text-[var(--text-muted)]">
                        {i() + 1}
                      </span>
                      <Show when={track.albumImageUrl}>
                        <img
                          src={track.albumImageUrl}
                          alt={track.album}
                          class="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      </Show>
                      <div class="min-w-0 flex-1">
                        <a
                          href={track.songUrl}
                          target="_blank"
                          rel="noreferrer"
                          class="block truncate font-semibold text-[var(--text)] no-underline hover:text-[var(--blue-deep)]"
                        >
                          {track.title}
                        </a>
                        <p class="m-0 truncate text-sm italic text-[var(--text-muted)]">
                          {track.artist}
                        </p>
                      </div>
                      <span class="hidden shrink-0 text-right text-sm text-[var(--text-muted)] sm:block">
                        {track.album}
                      </span>
                    </li>
                  )}
                </For>
              </ol>
            </Show>
          </div>
        </div>

        <Show when={dominantArtist()}>
          {(artist) => (
            <p data-testid="dominant-artist" class="mt-6 text-center text-sm text-[var(--text-muted)]">
              Yeah, I know it's a little embarrassing to have more than half my top ten be{' '}
              <span class="italic">{artist()}</span>.
            </p>
          )}
        </Show>
      </section>
    </main>
  )
}
