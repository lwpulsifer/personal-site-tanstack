import { createServerFn } from '@tanstack/react-start'
import { getSupabaseSessionClient } from './supabase'

// Server function called by the root loader to hydrate auth state on first render.
export const getServerUser = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
})

// Server function to sign out — clears the session cookie so subsequent SSR
// requests no longer see a logged-in user.
export const serverSignOut = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = getSupabaseSessionClient()
  await supabase.auth.signOut()
})
