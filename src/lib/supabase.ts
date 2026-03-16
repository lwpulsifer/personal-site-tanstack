import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

export type SiteView = {
  id: number
  creation_date: string
  user_ip: string
  url: string
}

// Server-side client (service-role key — bypasses RLS, never sent to browser).
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set')
  }
  return createClient(url, key)
}

// Browser-side client — stores session in cookies for SSR compatibility.
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.
export function getSupabaseBrowserClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
  }
  // Use an explicit storage/cookie key so browser + server always agree, even if
  // the Supabase URL differs slightly between build/runtime (localhost vs 127.0.0.1).
  return createBrowserClient(url, key, {
    cookieOptions: { name: 'sb-personal-site-auth' },
  })
}

