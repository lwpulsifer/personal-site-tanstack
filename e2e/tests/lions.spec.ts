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
  await expect(page.getByTestId('photos-heading')).toBeVisible()
})

test('report sighting button opens submission form', async ({ page }) => {
  await page.goto('/lions')
  await page.getByTestId('report-sighting-btn').click()
  await expect(page.getByTestId('submission-form-heading')).toBeVisible()
  await expect(page.getByTestId('field-name')).toBeVisible()
  await expect(page.getByTestId('field-lat')).toBeVisible()
})

test('submission form can be filled and submitted', async ({ page }) => {
  await page.goto('/lions')
  await page.getByTestId('report-sighting-btn').click()

  await page.getByTestId('field-name').fill('e2e-test-lion-submit')
  await page.getByTestId('field-address').fill('123 Test St')
  await page.getByTestId('field-lat').fill('37.78')
  await page.getByTestId('field-lng').fill('-122.42')
  await page.getByTestId('field-notes').fill('E2E test submission')

  await page.getByTestId('submit-sighting-btn').click()

  await expect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
})

test('submission form close button returns to sidebar', async ({ page }) => {
  await page.goto('/lions')
  await page.getByTestId('report-sighting-btn').click()
  await expect(page.getByTestId('submission-form-heading')).toBeVisible()

  // Close the form via the × button
  await page.getByTestId('close-form-btn').click()
  await expect(page.getByTestId('submission-form-heading')).not.toBeVisible()
})

// ── Admin (authenticated) ─────────────────────────────────────────────────────

adminTest.describe('admin: lion management', () => {
  const pendingSubmissionCard = (page: import('@playwright/test').Page, name: string) =>
    page.locator('[data-testid^="submission-card-"]').filter({ hasText: name })

  adminTest('admin panel is visible when authenticated', async ({ page }) => {
    await page.goto('/lions')
    await adminExpect(page.getByTestId('pending-submissions-heading').or(page.getByTestId('no-pending-submissions'))).toBeVisible({ timeout: 10_000 })
  })

  adminTest('admin can approve a submission', async ({ page }) => {
    await page.goto('/lions')

    // Submit a new sighting first
    await page.getByTestId('report-sighting-btn').click()
    await page.getByTestId('field-name').fill('e2e-test-lion-approve')
    await page.getByTestId('field-lat').fill('37.76')
    await page.getByTestId('field-lng').fill('-122.43')
    await page.getByTestId('submit-sighting-btn').click()
    await adminExpect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('submission-close-btn').click()

    // The admin panel should now show the pending submission
    const card = pendingSubmissionCard(page, 'e2e-test-lion-approve')
    await adminExpect(card).toBeVisible({ timeout: 10_000 })
    await card.getByTestId('approve-btn').click()

    // After approval the submission disappears from pending
    await adminExpect(pendingSubmissionCard(page, 'e2e-test-lion-approve')).toHaveCount(0, { timeout: 10_000 })

    // The new location should appear in the sidebar list
    await adminExpect(page.getByRole('button', { name: /e2e-test-lion-approve/ })).toBeVisible({ timeout: 10_000 })
  })

  adminTest('clicking a pending submission zooms the map', async ({ page }) => {
    await page.goto('/lions')

    // Submit a new sighting
    await page.getByTestId('report-sighting-btn').click()
    await page.getByTestId('field-name').fill('e2e-test-lion-zoom')
    await page.getByTestId('field-lat').fill('37.80')
    await page.getByTestId('field-lng').fill('-122.45')
    await page.getByTestId('submit-sighting-btn').click()
    await adminExpect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('submission-close-btn').click()

    // Click the pending submission in the admin panel
    const submissionCard = pendingSubmissionCard(page, 'e2e-test-lion-zoom')
    await adminExpect(submissionCard).toBeVisible({ timeout: 10_000 })
    await submissionCard.click()

    // A preview marker should appear on the map at the submission coordinates
    await adminExpect(page.locator('.leaflet-marker-icon').filter({ hasText: '📍' })).toBeVisible({ timeout: 5_000 })
  })

  adminTest('admin can reject a submission', async ({ page }) => {
    await page.goto('/lions')

    // Submit a new sighting
    await page.getByTestId('report-sighting-btn').click()
    await page.getByTestId('field-name').fill('e2e-test-lion-reject')
    await page.getByTestId('field-lat').fill('37.75')
    await page.getByTestId('field-lng').fill('-122.44')
    await page.getByTestId('submit-sighting-btn').click()
    await adminExpect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('submission-close-btn').click()

    // Reject it
    const card = pendingSubmissionCard(page, 'e2e-test-lion-reject')
    await adminExpect(card).toBeVisible({ timeout: 10_000 })
    await card.getByTestId('reject-btn').click()

    // Submission disappears from pending list
    await adminExpect(pendingSubmissionCard(page, 'e2e-test-lion-reject')).toHaveCount(0, { timeout: 10_000 })
  })
})
