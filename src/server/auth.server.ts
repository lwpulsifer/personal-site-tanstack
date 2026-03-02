import { getSupabaseServerClient } from './supabase'

// Throws 'Unauthorized' if there is no valid session in the request cookies.
// Call at the top of any admin server function handler.
export async function requireAuth() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return user
}
