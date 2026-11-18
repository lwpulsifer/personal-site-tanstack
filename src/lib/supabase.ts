import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

// Browser-side client — stores the session in cookies so server functions can
// read it. Same cookie name as server/supabase.ts.
export function getSupabaseBrowserClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
  }
  return createBrowserClient<Database>(url, key, {
    cookieOptions: { name: 'sb-personal-site-auth' },
  })
}
