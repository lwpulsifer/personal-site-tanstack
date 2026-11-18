// Server-only Supabase clients. Imported only from 'use server' function
// bodies, so the bundler keeps it out of the client build.
import { getRequestEvent } from '@solidjs/web'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { parseCookie, stringifySetCookie } from 'cookie'
import type { Database } from '../lib/database.types'

// Service-role client: bypasses RLS, never sent to the browser.
export function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_KEY must be set')
  return createClient<Database>(url, key)
}

// Reads the user session from request cookies; session refreshes ride the
// outgoing response via event.response.headers (replaces TanStack's setCookie).
export function getSupabaseSessionClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
  }
  const event = getRequestEvent()
  if (!event) throw new Error('No request event: call from a server function')
  return createServerClient<Database>(url, key, {
    // Keep in sync with getSupabaseBrowserClient().
    cookieOptions: { name: 'sb-personal-site-auth' },
    cookies: {
      getAll() {
        const parsed = parseCookie(event.request.headers.get('cookie') ?? '')
        return Object.entries(parsed).map(([name, value]) => ({
          name,
          value: value ?? '',
        }))
      },
      setAll(cookiesToSet) {
        // @supabase/ssr persists the session on every getUser(). During a
        // streamed render (e.g. reading the user for the header) the response
        // head has already flushed and Solid refuses the late write; that write
        // is redundant anyway since the browser client owns its own cookies.
        // Mutating server functions run before the head is sent and still write.
        for (const { name, value, options } of cookiesToSet) {
          try {
            event.response.headers.append(
              'set-cookie',
              stringifySetCookie({ name, value, ...(options as object) }),
            )
          } catch {
            // LATE_HEADER_WRITE: dropped on purpose.
          }
        }
      },
    },
  })
}

export async function requireAuth() {
  const supabase = getSupabaseSessionClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return user
}
