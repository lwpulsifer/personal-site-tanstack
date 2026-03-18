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
