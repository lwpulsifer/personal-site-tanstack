import { getCookies, setCookie } from '@tanstack/react-start/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Builds a Supabase server client that reads/writes the user session from
 * request cookies. Used by both auth.ts (getServerUser server fn) and
 * auth.server.ts (requireAuth helper).
 *
 * Lives in a non-*.server.* file so TanStack Start's import-protection plugin
 * does not block client routes from statically importing files that call this
 * function inside server-fn handlers (the handler body is stripped from the
 * client bundle at build time).
 */
export function getSupabaseServerClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        const cookies = getCookies()
        return Object.entries(cookies).map(([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options)
        }
      },
    },
  })
}
