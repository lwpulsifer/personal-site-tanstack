import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const TEST_EMAIL = 'e2e-admin@example.com'

export default async function globalTeardown() {
  if (!SERVICE_ROLE_KEY) return // nothing to clean up if we can't connect

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Delete any posts created during e2e tests
  await supabase.from('posts').delete().like('slug', 'e2e-test-%')

  // Delete any map submissions/locations created during e2e tests
  await supabase.from('map_submissions').delete().like('proposed_name', 'e2e-test-%')
  await supabase.from('map_locations').delete().like('name', 'e2e-test-%')

  // Delete the test admin user
  const { data } = await supabase.auth.admin.listUsers()
  const user = data?.users.find((u) => u.email === TEST_EMAIL)
  if (user) await supabase.auth.admin.deleteUser(user.id)
}
