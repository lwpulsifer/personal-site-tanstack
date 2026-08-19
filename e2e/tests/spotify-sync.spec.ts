import { test as anonTest, expect } from '@playwright/test'
import { test, expect as authExpect } from '../fixtures/auth'
import { ensureHydrated } from '../utils/ui'

anonTest.describe('spotify sync (anonymous)', () => {
  anonTest('visiting /spotifysync 404s instead of revealing the page', async ({ page }) => {
    const response = await page.goto('/spotifysync')
    expect(response?.status()).toBe(404)
    await ensureHydrated(page)
    await expect(page.getByTestId('spotify-sync-heading')).toHaveCount(0)
  })

  anonTest('visiting /spotifycallback 404s instead of revealing the page', async ({ page }) => {
    const response = await page.goto('/spotifycallback')
    expect(response?.status()).toBe(404)
  })
})

test.describe('admin: spotify sync', () => {
  test('shows a connect link pointing at Spotify authorize with the right redirect_uri', async ({
    page,
  }) => {
    await page.goto('/spotifysync')
    await ensureHydrated(page)
    await authExpect(page.getByTestId('spotify-sync-heading')).toBeVisible()

    const href = await page.getByTestId('spotify-connect-link').getAttribute('href')
    expect(href).toContain('https://accounts.spotify.com/authorize')
    expect(href).toContain('response_type=code')
    expect(href).toContain(
      `redirect_uri=${encodeURIComponent('https://liampulsifer.com/spotifycallback')}`,
    )
  })

  test('shows an error when the callback is hit without a code', async ({ page }) => {
    await page.goto('/spotifycallback')
    await ensureHydrated(page)
    await authExpect(page.getByTestId('spotify-callback-error')).toContainText('missing_code')
  })
})
