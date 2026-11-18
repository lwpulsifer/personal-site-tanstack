import { expect, test } from '@playwright/test'

// These testids exist only in the Solid app (the default e2e target).
test.skip(process.env.E2E_TARGET === 'react', 'Solid-only testids')

test('Fun page renders tracks or the empty state (Spotify is non-deterministic)', async ({ page }) => {
  await page.goto('/fun')
  const list = page.getByTestId('tracks-list')
  const empty = page.getByTestId('tracks-empty')
  await expect(list.or(empty)).toBeVisible()
  if (await list.isVisible()) {
    await expect(page.getByTestId('track-item').first()).toBeVisible()
  }
})

test('unknown routes render the 404 page', async ({ page }) => {
  const res = await page.goto('/nope')
  expect(res?.status()).toBe(404)
  await expect(page.getByTestId('not-found-heading')).toBeVisible()
})
