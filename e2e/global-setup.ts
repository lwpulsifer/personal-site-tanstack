import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync } from 'node:fs'
import fs from 'node:fs'
import dotenv from 'dotenv'
import { ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_EMAIL, AUTH_PASSWORD } from './utils/credentials'

// Make local runs "just work" after `npm run supabase:env`.
dotenv.config({ path: '.env.local' })
if (fs.existsSync('.env.supabase')) {
  dotenv.config({ path: '.env.supabase', override: true })
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const AUTH_STATE_PATH = 'e2e/.auth/admin.json'
const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? '3000'}`
const AUTH_COOKIE_PREFIX = 'sb-personal-site-auth'

async function waitForAuthCookie(page: import('@playwright/test').Page, timeoutMs = 10_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const cookies = await page.context().cookies()
    // Auth cookies may be either:
    // - custom cookieOptions.name (we use `sb-personal-site-auth`, possibly chunked)
    // - default Supabase cookie `sb-*-auth-token` (also possibly chunked)
    if (
      cookies.some(
        (c) =>
          c.name === AUTH_COOKIE_PREFIX ||
          c.name.startsWith(`${AUTH_COOKIE_PREFIX}.`) ||
          /^sb-.*-auth-token(\.\d+)?$/.test(c.name),
      )
    ) {
      return
    }
    await page.waitForTimeout(100)
  }
  throw new Error('Timed out waiting for Supabase auth cookie to be set')
}

async function fillStable(
  locator: import('@playwright/test').Locator,
  value: string,
  timeoutMs = 10_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await locator.fill(value)
    // Give hydration a moment; if React wasn't hydrated yet, it can overwrite.
    await locator.page().waitForTimeout(100)
    const current = await locator.inputValue().catch(() => '')
    if (current === value) return
  }
  throw new Error('Timed out waiting for input value to stick (hydration?)')
}

export default async function globalSetup() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. In CI it is extracted from `supabase status`. ' +
        'Locally, run `npm run supabase:env` (or `npm run e2e:local`) to generate `.env.supabase`.',
    )
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Remove any stale test user from a previous run
  const { data } = await supabase.auth.admin.listUsers()
  for (const email of [ADMIN_EMAIL, AUTH_EMAIL]) {
    const existing = data?.users.find((u) => u.email === email)
    if (existing) await supabase.auth.admin.deleteUser(existing.id)
  }

  // Create fresh test users
  const { error: adminUserError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  })
  if (adminUserError) throw new Error(`Failed to create e2e admin user: ${adminUserError.message}`)

  const { error: authUserError } = await supabase.auth.admin.createUser({
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD,
    email_confirm: true,
  })
  if (authUserError) throw new Error(`Failed to create e2e auth user: ${authUserError.message}`)

  // Log in via browser and save session state (cookies + localStorage)
  mkdirSync('e2e/.auth', { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${BASE_URL}/login`)
  // Wait for React hydration marker (see src/routes/__root.tsx).
  await page.waitForSelector('body[data-hydrated="true"]', { timeout: 30_000 })
  await fillStable(page.getByTestId('login-email'), ADMIN_EMAIL, 15_000)
  await fillStable(page.getByTestId('login-password'), ADMIN_PASSWORD, 15_000)
  await page.getByTestId('login-submit').click()

  // TanStack Start navigation may not trigger a full page load; prefer URL predicate and cookie.
  try {
    await page.waitForURL((url) => url.origin === BASE_URL && url.pathname === '/', { timeout: 60_000 })
  } catch {
    // If login failed, the login page renders a testable error.
    const errVisible = await page.getByTestId('login-error').isVisible().catch(() => false)
    if (errVisible) {
      const msg = await page.getByTestId('login-error').textContent()
      throw new Error(`Login failed during e2e global setup: ${msg ?? '(no message)'}`)
    }
    throw new Error('Login did not redirect to / during e2e global setup')
  }

  await waitForAuthCookie(page, 30_000)

  await page.context().storageState({ path: AUTH_STATE_PATH })
  await browser.close()
}
