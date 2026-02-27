import { createServerFn } from '@tanstack/react-start'
import { fetchNowPlaying, fetchTopTracks } from '#/lib/spotify'

export const getNowPlaying = createServerFn({ method: 'GET' }).handler(
  async () => {
    return fetchNowPlaying()
  },
)

export const getTopTracks = createServerFn({ method: 'GET' }).handler(
  async () => {
    return fetchTopTracks(10)
  },
)
