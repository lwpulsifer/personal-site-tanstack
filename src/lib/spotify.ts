const client_id = process.env.SPOTIFY_CLIENT_ID
const client_secret = process.env.SPOTIFY_CLIENT_SECRET
const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN

const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`
const NOW_PLAYING_ENDPOINT = `https://api.spotify.com/v1/me/player/currently-playing`
const TOP_TRACKS_ENDPOINT = `https://api.spotify.com/v1/me/top/tracks`

async function getAccessToken(): Promise<{ access_token: string }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token ?? '',
    }).toString(),
  })
  return response.json()
}

export type NowPlayingData =
  | { isPlaying: false }
  | {
      isPlaying: true
      title: string
      artist: string
      album: string
      albumImageUrl: string
      songUrl: string
    }

export async function fetchNowPlaying(): Promise<NowPlayingData> {
  const { access_token } = await getAccessToken()
  const response = await fetch(NOW_PLAYING_ENDPOINT, {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (response.status === 204 || response.status > 400) {
    return { isPlaying: false }
  }

  const song = await response.json()

  if (!song.item) {
    return { isPlaying: false }
  }

  return {
    isPlaying: song.is_playing,
    title: song.item.name,
    artist: song.item.artists.map((a: { name: string }) => a.name).join(', '),
    album: song.item.album.name,
    albumImageUrl: song.item.album.images[0]?.url ?? '',
    songUrl: song.item.external_urls.spotify,
  }
}

export type TopTrack = {
  id: string
  title: string
  artist: string
  album: string
  albumImageUrl: string
  songUrl: string
}

export async function fetchTopTracks(limit = 10): Promise<TopTrack[]> {
  const { access_token } = await getAccessToken()
  const response = await fetch(`${TOP_TRACKS_ENDPOINT}?limit=${limit}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const data = await response.json()
  return (data.items ?? []).map(
    (track: {
      id: string
      name: string
      artists: Array<{ name: string }>
      album: { name: string; images: Array<{ url: string }> }
      external_urls: { spotify: string }
    }) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      album: track.album.name,
      albumImageUrl: track.album.images[0]?.url ?? '',
      songUrl: track.external_urls.spotify,
    }),
  )
}
