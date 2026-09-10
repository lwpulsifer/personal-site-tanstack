import { getSupabaseSessionClient } from './supabase'

// Returns the current user, or null if there is no valid session. Never
// throws — for call sites that need to branch on admin-vs-anonymous rather
// than reject anonymous access outright.
export async function getAuthUser() {
  const supabase = getSupabaseSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Throws 'Unauthorized' if there is no valid session in the request cookies.
// Call at the top of any admin server function handler.
export async function requireAuth() {
  const user = await getAuthUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
