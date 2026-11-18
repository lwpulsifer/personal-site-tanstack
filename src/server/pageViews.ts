import { getRequestEvent, respond } from '@solidjs/web'
import { query } from '@solidjs/router'
import { z } from 'zod'
import { parse } from './validate'

export async function logPageView(url: string) {
  'use server'
  url = parse(z.string(), url)
  const skip =
    process.env.NODE_ENV === 'development' &&
    process.env.DEBUG_PAGE_VIEWS !== 'true'
  // Logging isn't a mutation of anything on screen: touch no queries.
  if (skip) return respond({ ok: true, dev: true }, { revalidate: '' })
  const { getSupabaseServiceClient } = await import('./supabase')
  const forwarded = getRequestEvent()?.request.headers.get('x-forwarded-for')
  const userIp = forwarded?.split(',')[0]?.trim() || 'unknown'
  const { error } = await getSupabaseServiceClient()
    .from('site_views')
    .insert({ url, user_ip: userIp })
  if (error) console.error('Failed to log page view:', error.message)
  return respond({ ok: !error }, { revalidate: '' })
}

export const getPageViews = query(async (url: string) => {
  'use server'
  url = parse(z.string(), url)
  const { getSupabaseServiceClient } = await import('./supabase')
  const { count, error } = await getSupabaseServiceClient()
    .from('site_views')
    .select('*', { count: 'exact', head: true })
    .eq('url', url)
  if (error) {
    console.error('Failed to fetch page views:', error.message)
    return null
  }
  return count
}, 'page-views')
