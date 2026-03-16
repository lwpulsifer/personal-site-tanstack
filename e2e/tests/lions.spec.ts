import { test, expect } from '@playwright/test'
import { test as adminTest, expect as adminExpect } from '../fixtures/auth'

// ── Smoke (unauthenticated) ───────────────────────────────────────────────────

test('lions page loads with heading and map', async ({ page }) => {
  await page.goto('/lions')
  await expect(page.getByRole('heading', { name: /Lions of SF/i, level: 1 })).toBeVisible()
  await expect(
    page.locator('.leaflet-container').or(page.getByText('Loading map...')),
  ).toBeVisible({ timeout: 10_000 })
})

test('seeded lion locations appear in sidebar list', async ({ page }) => {
  await page.goto('/lions')
  await expect(page.getByText('Palace of Fine Arts Lions')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('City Hall Lions')).toBeVisible()
})

test('clicking a location in sidebar shows detail panel', async ({ page }) => {
  await page.goto('/lions')
  await page.getByRole('button', { name: /Palace of Fine Arts Lions/ }).click()
  await expect(page.getByRole('heading', { name: 'Palace of Fine Arts Lions' })).toBeVisible()
  await expect(page.getByText('Photos')).toBeVisible()
})

test('report sighting button opens submission form', async ({ page }) => {
  await page.goto('/lions')
  await page.getByRole('button', { name: /Report Sighting/i }).click()
  await expect(page.getByText('Report a Lion Sighting')).toBeVisible()
  await expect(page.getByLabel(/Name/i)).toBeVisible()
  await expect(page.getByLabel(/Latitude/i)).toBeVisible()
})

test('submission form can be filled and submitted', async ({ page }) => {
  await page.goto('/lions')
  await page.getByRole('button', { name: /Report Sighting/i }).click()

  await page.getByLabel(/Name/i).fill('e2e-test-lion-submit')
  await page.getByLabel(/Address/i).fill('123 Test St')
  await page.getByLabel(/Latitude/i).fill('37.78')
  await page.getByLabel(/Longitude/i).fill('-122.42')
  await page.getByLabel(/Notes/i).fill('E2E test submission')

  await page.getByRole('button', { name: /Submit Sighting/i }).click()

  await expect(page.getByText(/Thanks for your submission/i)).toBeVisible({ timeout: 10_000 })
})

test('submission form close button returns to sidebar', async ({ page }) => {
  await page.goto('/lions')
  await page.getByRole('button', { name: /Report Sighting/i }).click()
  await expect(page.getByText('Report a Lion Sighting')).toBeVisible()

  // Close the form via the × button
  await page.locator('.island-shell').getByRole('button', { name: '×' }).click()
  await expect(page.getByText('Report a Lion Sighting')).not.toBeVisible()
})

// ── Admin (authenticated) ─────────────────────────────────────────────────────

adminTest.describe('admin: lion management', () => {
  adminTest('admin panel is visible when authenticated', async ({ page }) => {
    await page.goto('/lions')
    await adminExpect(page.getByText(/Pending Submissions/i).or(page.getByText('No pending submissions'))).toBeVisible({ timeout: 10_000 })
  })

  adminTest('admin can approve a submission', async ({ page }) => {
    await page.goto('/lions')

    // Submit a new sighting first
    await page.getByRole('button', { name: /Report Sighting/i }).click()
    await page.getByLabel(/Name/i).fill('e2e-test-lion-approve')
    await page.getByLabel(/Latitude/i).fill('37.76')
    await page.getByLabel(/Longitude/i).fill('-122.43')
    await page.getByRole('button', { name: /Submit Sighting/i }).click()
    await adminExpect(page.getByText(/Thanks for your submission/i)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Close' }).click()

    // The admin panel should now show the pending submission
    await adminExpect(page.getByText('e2e-test-lion-approve')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Approve' }).first().click()

    // After approval the submission disappears from pending
    await adminExpect(page.getByText('e2e-test-lion-approve')).not.toBeVisible({ timeout: 10_000 })

    // The new location should appear in the sidebar list
    await adminExpect(page.getByRole('button', { name: /e2e-test-lion-approve/ })).toBeVisible({ timeout: 10_000 })
  })

  adminTest('clicking a pending submission zooms the map', async ({ page }) => {
    await page.goto('/lions')

    // Submit a new sighting
    await page.getByRole('button', { name: /Report Sighting/i }).click()
    await page.getByLabel(/Name/i).fill('e2e-test-lion-zoom')
    await page.getByLabel(/Latitude/i).fill('37.80')
    await page.getByLabel(/Longitude/i).fill('-122.45')
    await page.getByRole('button', { name: /Submit Sighting/i }).click()
    await adminExpect(page.getByText(/Thanks for your submission/i)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Close' }).click()

    // Click the pending submission in the admin panel
    const submissionCard = page.getByRole('button', { name: /e2e-test-lion-zoom/ })
    await adminExpect(submissionCard).toBeVisible({ timeout: 10_000 })
    await submissionCard.click()

    // A preview marker should appear on the map at the submission coordinates
    await adminExpect(page.locator('.leaflet-marker-icon').filter({ hasText: '📍' })).toBeVisible({ timeout: 5_000 })
  })

  adminTest('admin can reject a submission', async ({ page }) => {
    await page.goto('/lions')

    // Submit a new sighting
    await page.getByRole('button', { name: /Report Sighting/i }).click()
    await page.getByLabel(/Name/i).fill('e2e-test-lion-reject')
    await page.getByLabel(/Latitude/i).fill('37.75')
    await page.getByLabel(/Longitude/i).fill('-122.44')
    await page.getByRole('button', { name: /Submit Sighting/i }).click()
    await adminExpect(page.getByText(/Thanks for your submission/i)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Close' }).click()

    // Reject it
    await adminExpect(page.getByText('e2e-test-lion-reject')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Reject' }).first().click()

    // Submission disappears from pending list
    await adminExpect(page.getByText('e2e-test-lion-reject')).not.toBeVisible({ timeout: 10_000 })
  })
})
