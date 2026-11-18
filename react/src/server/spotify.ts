import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { SITE_URL } from '#/lib/site'
import {
  exchangeSpotifyAuthCode,
  fetchNowPlaying,
  fetchTopTracks,
  getSpotifyAuthorizeUrl,
} from '#/lib/spotify'
import { requireAuth } from '#/server/auth.server'

export const getNowPlaying = createServerFn({ method: 'GET' }).handler(
  fetchNowPlaying,
)

export const getTopTracks = createServerFn({ method: 'GET' }).handler(() =>
  fetchTopTracks(10),
)

// ── Admin: re-authorization ──────────────────────────────────────────────────

export const SPOTIFY_CALLBACK_REDIRECT_URI = `${SITE_URL}/spotifycallback`

export const getAuthorizeUrl = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAuth()
    return getSpotifyAuthorizeUrl(SPOTIFY_CALLBACK_REDIRECT_URI)
  },
)

export const exchangeCode = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ code: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    return exchangeSpotifyAuthCode(data.code, SPOTIFY_CALLBACK_REDIRECT_URI)
  })
