// Server function: 'use server' makes this a plain call during SSR and a typed
// fetch in the browser. query() caches per key and is what <Loading> waits on.
// Replaces the React app's createServerFn + route loader.
import { query } from '@solidjs/router'
import type { TopTrack } from './spotify'

export type { TopTrack }

// Opt-in (SOLID_FIXTURES=1) so the populated layout can be compared even when
// the local Spotify refresh token is revoked.
const FIXTURE_TRACKS: TopTrack[] = [
  ['Pink + White', 'Frank Ocean', 'Blonde'],
  ['Nights', 'Frank Ocean', 'Blonde'],
  ['Ivy', 'Frank Ocean', 'Blonde'],
  ['Self Control', 'Frank Ocean', 'Blonde'],
  ['Godspeed', 'Frank Ocean', 'Blonde'],
  ['Skyline To', 'Frank Ocean', 'Blonde'],
  ['Dissolve Me', 'Alt-J', 'An Awesome Wave'],
].map(([title, artist, album], i) => ({
  id: String(i),
  title,
  artist,
  album,
  albumImageUrl: '',
  songUrl: 'https://open.spotify.com',
}))

export const getTopTracks = query(async (): Promise<TopTrack[]> => {
  'use server'
  if (process.env.SOLID_FIXTURES === '1') return FIXTURE_TRACKS
  try {
    // Reuse the React app's Spotify client unchanged.
    const { fetchTopTracks } = await import('./spotify')
    return await fetchTopTracks()
  } catch {
    return []
  }
}, 'top-tracks')
