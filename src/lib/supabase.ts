import { createClient } from '@supabase/supabase-js'

export type SiteView = {
  id: number
  creation_date: string
  user_ip: string
  url: string
}

// These are only used server-side (inside server functions), so it's safe to
// reference process.env directly.
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set')
  }
  return createClient(url, key)
}
