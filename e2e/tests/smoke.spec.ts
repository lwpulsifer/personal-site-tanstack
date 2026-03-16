import { test, expect } from '@playwright/test'
import { ensureHydrated } from '../utils/ui'

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Liam Pulsifer/)
})

test('blog listing loads', async ({ page }) => {
  await page.goto('/blog')
  await ensureHydrated(page)
  await expect(page.getByTestId('blog-heading')).toBeVisible()
})

test('individual blog post loads', async ({ page }) => {
  await page.goto('/blog/hello-world')
  await ensureHydrated(page)
  await expect(page.getByTestId('post-heading')).toBeVisible()
})
