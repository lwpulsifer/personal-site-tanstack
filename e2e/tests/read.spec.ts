import { test, expect } from '@playwright/test'
import { test as adminTest, expect as adminExpect } from '../fixtures/auth'
import { ensureHydrated } from '../utils/ui'

// ── Unauthenticated ───────────────────────────────────────────────────────────

test('read page renders heading', async ({ page }) => {
  await page.goto('/read')
  await ensureHydrated(page)
  await expect(page.getByTestId('read-heading')).toBeVisible()
})

test('header has a Read link that navigates to /read', async ({ page }) => {
  await page.goto('/')
  await ensureHydrated(page)
  await page.getByRole('link', { name: 'Read', exact: true }).click()
  await expect(page).toHaveURL('/read')
  await expect(page.getByTestId('read-heading')).toBeVisible()
})

test('admin subscription form is hidden from anonymous visitors', async ({ page }) => {
  await page.goto('/read')
  await ensureHydrated(page)
  await expect(page.getByTestId('feeds-admin')).toHaveCount(0)
})

// ── Admin ─────────────────────────────────────────────────────────────────────

adminTest('admin sees the subscription manager with form controls', async ({ page }) => {
  await page.goto('/read')
  await ensureHydrated(page)
  await adminExpect(page.getByTestId('feeds-admin')).toBeVisible()
  await adminExpect(page.getByTestId('feed-url-input')).toBeVisible()
  await adminExpect(page.getByTestId('add-feed-btn')).toBeVisible()
})
