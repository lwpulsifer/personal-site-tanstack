import { test, expect } from '@playwright/test'

test.describe('blog listing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog')
  })

  test('shows seeded published posts', async ({ page }) => {
    await expect(page.getByText('Hello World')).toBeVisible()
    await expect(page.getByText('Second Post')).toBeVisible()
  })

  test('hides pending posts from anonymous visitors', async ({ page }) => {
    await expect(page.getByText('Draft Post')).not.toBeVisible()
  })

  test('tag filter shows only matching posts', async ({ page }) => {
    await page.getByPlaceholder('Filter by tag').fill('intro')
    await expect(page.getByText('Hello World')).toBeVisible()
    await expect(page.getByText('Second Post')).not.toBeVisible()
  })

  test('clear button resets the tag filter', async ({ page }) => {
    await page.getByPlaceholder('Filter by tag').fill('intro')
    await expect(page.getByText('Second Post')).not.toBeVisible()
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByText('Second Post')).toBeVisible()
  })
})

test.describe('individual post', () => {
  test('clicking a post card link navigates to the post', async ({ page }) => {
    await page.goto('/blog')
    await page.getByRole('link', { name: 'Hello World' }).first().click()
    await expect(page).toHaveURL('/blog/hello-world')
  })

  test('renders post title and markdown content', async ({ page }) => {
    await page.goto('/blog/hello-world')
    await expect(page.getByText('Hello World')).toBeVisible()
    await expect(page.getByText('Welcome to the test blog.')).toBeVisible()
  })
})
