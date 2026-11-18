export type Track = { artist: string }

// Easter egg: if one artist makes up more than half the list, return them.
export function findDominantArtist(tracks: Track[]): string | undefined {
  if (tracks.length === 0) return undefined
  const counts = new Map<string, number>()
  for (const t of tracks) counts.set(t.artist, (counts.get(t.artist) ?? 0) + 1)
  for (const [artist, count] of counts) {
    if (count / tracks.length > 0.5) return artist
  }
  return undefined
}
