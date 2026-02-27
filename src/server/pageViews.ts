import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { getSupabaseClient } from '#/lib/supabase'
import { z } from 'zod'

const isDev = () => process.env.NODE_ENV === 'development'

export const logPageView = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ url: z.string() }))
  .handler(async ({ data }) => {
    if (isDev()) return { ok: true, dev: true }

    const userIp = getRequestIP({ xForwardedFor: true }) ?? 'unknown'

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('site_views')
      .insert({ url: data.url, user_ip: userIp })

    if (error) {
      console.error('Failed to log page view:', error.message)
    }

    return { ok: !error }
  })

export const getPageViews = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ url: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient()
    const { count, error } = await supabase
      .from('site_views')
      .select('*', { count: 'exact', head: true })
      .eq('url', data.url)

    if (error) {
      console.error('Failed to fetch page views:', error.message)
      return null
    }

    return count
  })
