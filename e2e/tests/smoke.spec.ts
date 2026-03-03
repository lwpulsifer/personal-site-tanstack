import { test, expect } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Liam Pulsifer/)
})

test('blog listing loads', async ({ page }) => {
  await page.goto('/blog')
  await expect(page.getByRole('heading', { name: 'Blog', level: 1 })).toBeVisible()
})

test('individual blog post loads', async ({ page }) => {
  await page.goto('/blog/hello-world')
  await expect(page.getByText('Hello World')).toBeVisible()
})
