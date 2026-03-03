import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync } from 'node:fs'

// These are the well-known deterministic credentials for `supabase start`.
// They are derived from the fixed local JWT secret and safe to commit — they
// only work against the local Docker stack.
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SB_E'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY

export const TEST_EMAIL = 'e2e-admin@example.com'
export const TEST_PASSWORD = 'e2e-test-password-123!'

const AUTH_STATE_PATH = 'e2e/.auth/admin.json'
const BASE_URL = 'http://localhost:3000'

export default async function globalSetup() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Remove any stale test user from a previous run
  const { data } = await supabase.auth.admin.listUsers()
  const existing = data?.users.find((u) => u.email === TEST_EMAIL)
  if (existing) await supabase.auth.admin.deleteUser(existing.id)

  // Create a fresh test admin user
  const { error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`Failed to create e2e test user: ${error.message}`)

  // Log in via browser and save session state (cookies + localStorage)
  mkdirSync('e2e/.auth', { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${BASE_URL}/`)

  await page.context().storageState({ path: AUTH_STATE_PATH })
  await browser.close()
}
