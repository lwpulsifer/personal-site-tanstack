import { createClient } from '@supabase/supabase-js'

const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SB_E'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY
const TEST_EMAIL = 'e2e-admin@example.com'

export default async function globalTeardown() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Delete any posts created during e2e tests
  await supabase.from('posts').delete().like('slug', 'e2e-test-%')

  // Delete the test admin user
  const { data } = await supabase.auth.admin.listUsers()
  const user = data?.users.find((u) => u.email === TEST_EMAIL)
  if (user) await supabase.auth.admin.deleteUser(user.id)
}
