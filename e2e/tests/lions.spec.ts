import { test, expect } from '@playwright/test'
import { test as adminTest, expect as adminExpect } from '../fixtures/auth'
import { ensureHydrated, fillStable } from '../utils/ui'

// ── Smoke (unauthenticated) ───────────────────────────────────────────────────

const tinyPng = Buffer.from(
  // 1x1 transparent PNG
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax0f4YAAAAASUVORK5CYII=',
  'base64',
)

test('lions page loads with heading and map', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await expect(page.getByTestId('lions-heading')).toBeVisible()
  await expect(
    page.getByTestId('map-container').or(page.getByTestId('map-loading')),
  ).toBeVisible({ timeout: 10_000 })
})

test('seeded lion locations appear in sidebar list', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await expect(page.getByTestId('location-btn-palace-of-fine-arts-lions')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('location-btn-city-hall-lions')).toBeVisible()
})

test('clicking a location in sidebar shows detail panel', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await page.getByTestId('location-btn-palace-of-fine-arts-lions').click()
  await expect(page.getByTestId('location-detail')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('photos-heading')).toBeVisible()
})

test('report sighting button opens submission form', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await page.getByTestId('report-sighting-btn').click()
  await expect(page.getByTestId('submission-form-heading')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('field-name')).toBeVisible()
  await expect(page.getByTestId('field-lat')).toBeVisible()
})

test('submission form can be filled and submitted', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await page.getByTestId('report-sighting-btn').click()

  await fillStable(page.getByTestId('field-name'), 'e2e-test-lion-submit')
  await fillStable(page.getByTestId('field-address'), '123 Test St')
  await fillStable(page.getByTestId('field-lat'), '37.78')
  await fillStable(page.getByTestId('field-lng'), '-122.42')
  await fillStable(page.getByTestId('field-notes'), 'E2E test submission')

  await page.getByTestId('submit-sighting-btn').click()

  await expect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
})

test('new sighting near an existing location suggests adding photos instead (dismissible)', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await page.getByTestId('report-sighting-btn').click()

  // City Hall Lions from seed.sql: 37.7793, -122.4193
  await fillStable(page.getByTestId('field-lat'), '37.7793')
  await fillStable(page.getByTestId('field-lng'), '-122.4193')

  await expect(page.getByTestId('nearby-location-prompt')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nearby-location-name')).toContainText('City Hall Lions')

  await page.getByTestId('nearby-location-dismiss').click()
  await expect(page.getByTestId('nearby-location-prompt')).not.toBeVisible()
})

test('submission form close button returns to sidebar', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await page.getByTestId('report-sighting-btn').click()
  await expect(page.getByTestId('submission-form-heading')).toBeVisible({ timeout: 10_000 })

  // Close the form via the × button
  await page.getByTestId('close-form-btn').click()
  await expect(page.getByTestId('submission-form-heading')).not.toBeVisible()
})

test('can submit additional photos for an existing location (multiple files)', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await page.getByTestId('location-btn-city-hall-lions').click()
  await expect(page.getByTestId('location-detail')).toBeVisible({ timeout: 10_000 })

  await page.getByTestId('add-photos-btn').click()
  await expect(page.getByTestId('submission-form-heading')).toHaveText('Add Photos')
  await expect(page.getByTestId('add-photos-hint')).toBeVisible()

  await page.getByTestId('field-photos').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: tinyPng },
    { name: 'b.png', mimeType: 'image/png', buffer: tinyPng },
  ])

  await page.getByTestId('submit-sighting-btn').click()
  await expect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
})

// ── Admin (authenticated) ─────────────────────────────────────────────────────

adminTest.describe('admin: lion management', () => {
  const pendingSubmissionCard = (page: import('@playwright/test').Page, name: string) =>
    page.getByTestId(`submission-card-${name}`)

adminTest('admin panel is visible when authenticated', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)
  await adminExpect(page.getByTestId('lions-admin-panel')).toBeVisible({ timeout: 10_000 })
  await adminExpect(
    page.getByTestId('pending-submissions-heading').or(page.getByTestId('no-pending-submissions')),
  ).toBeVisible({ timeout: 20_000 })
})

adminTest('admin can approve a submission', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)

  // Submit a new sighting first
  await page.getByTestId('report-sighting-btn').click()
  await fillStable(page.getByTestId('field-name'), 'e2e-test-lion-approve')
  await fillStable(page.getByTestId('field-lat'), '37.76')
  await fillStable(page.getByTestId('field-lng'), '-122.43')
  await page.getByTestId('submit-sighting-btn').click()
  await adminExpect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('submission-close-btn').click()

    // The admin panel should now show the pending submission
    const card = pendingSubmissionCard(page, 'e2e-test-lion-approve')
    await adminExpect(card).toBeVisible({ timeout: 20_000 })
    await card.getByTestId('approve-btn').click()

    // After approval the submission disappears from pending
    await adminExpect(pendingSubmissionCard(page, 'e2e-test-lion-approve')).not.toBeVisible({ timeout: 10_000 })

    // The new location should appear in the sidebar list
    await adminExpect(page.getByTestId('location-btn-e2e-test-lion-approve')).toBeVisible({ timeout: 10_000 })
  })

adminTest('clicking a pending submission zooms the map', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)

  // Submit a new sighting
  await page.getByTestId('report-sighting-btn').click()
  await fillStable(page.getByTestId('field-name'), 'e2e-test-lion-zoom')
  await fillStable(page.getByTestId('field-lat'), '37.80')
  await fillStable(page.getByTestId('field-lng'), '-122.45')
  await page.getByTestId('submit-sighting-btn').click()
  await adminExpect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('submission-close-btn').click()

    // Click the pending submission in the admin panel
    const submissionCard = pendingSubmissionCard(page, 'e2e-test-lion-zoom')
    await adminExpect(submissionCard).toBeVisible({ timeout: 20_000 })
    await submissionCard.click()

    // A preview marker should appear on the map at the submission coordinates
    await adminExpect(page.getByTestId('map-preview-marker')).toBeVisible({ timeout: 5_000 })
  })

adminTest('admin can reject a submission', async ({ page }) => {
  await page.goto('/lions/')
  await ensureHydrated(page)

  // Submit a new sighting
  await page.getByTestId('report-sighting-btn').click()
  await fillStable(page.getByTestId('field-name'), 'e2e-test-lion-reject')
  await fillStable(page.getByTestId('field-lat'), '37.75')
  await fillStable(page.getByTestId('field-lng'), '-122.44')
  await page.getByTestId('submit-sighting-btn').click()
  await adminExpect(page.getByTestId('submission-success')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('submission-close-btn').click()

    // Reject it
    const card = pendingSubmissionCard(page, 'e2e-test-lion-reject')
    await adminExpect(card).toBeVisible({ timeout: 20_000 })
    await card.getByTestId('reject-btn').click()

    // Submission disappears from pending list
    await adminExpect(pendingSubmissionCard(page, 'e2e-test-lion-reject')).not.toBeVisible({ timeout: 10_000 })
  })
})
