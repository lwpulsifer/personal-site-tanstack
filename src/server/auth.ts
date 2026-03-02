import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServerClient } from './supabase'

// Server function called by the root loader to hydrate auth state on first render.
export const getServerUser = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
})
