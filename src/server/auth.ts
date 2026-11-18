import { query } from '@solidjs/router'

// The signed-in user (or null), read from the session cookie. Seeds auth
// state on first render, like the React root loader's getServerUser.
export const getServerUser = query(async () => {
  'use server'
  const { getSupabaseSessionClient } = await import('./supabase')
  const {
    data: { user },
  } = await getSupabaseSessionClient().auth.getUser()
  return user ?? null
}, 'server-user')

// Clears the session cookie so subsequent SSR requests see a signed-out user.
export async function serverSignOut() {
  'use server'
  const { getSupabaseSessionClient } = await import('./supabase')
  await getSupabaseSessionClient().auth.signOut()
}
