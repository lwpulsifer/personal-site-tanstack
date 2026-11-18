import { query } from '@solidjs/router'
import { z } from 'zod'
import { SITE_URL } from '../lib/site'
import type { NowPlayingData, SpotifyTokenExchangeResult } from '../lib/spotify'
import { parse } from './validate'

export const SPOTIFY_CALLBACK_REDIRECT_URI = `${SITE_URL}/spotifycallback`

export const getNowPlaying = query(async (): Promise<NowPlayingData> => {
  'use server'
  const { fetchNowPlaying } = await import('../lib/spotify')
  return fetchNowPlaying()
}, 'now-playing')

export const getAuthorizeUrl = query(async () => {
  'use server'
  const { requireAuth } = await import('./supabase')
  const { getSpotifyAuthorizeUrl } = await import('../lib/spotify')
  await requireAuth()
  return getSpotifyAuthorizeUrl(SPOTIFY_CALLBACK_REDIRECT_URI)
}, 'spotify-authorize-url')

export async function exchangeCode(code: string): Promise<SpotifyTokenExchangeResult> {
  'use server'
  code = parse(z.string(), code)
  const { requireAuth } = await import('./supabase')
  const { exchangeSpotifyAuthCode } = await import('../lib/spotify')
  await requireAuth()
  return exchangeSpotifyAuthCode(code, SPOTIFY_CALLBACK_REDIRECT_URI)
}
