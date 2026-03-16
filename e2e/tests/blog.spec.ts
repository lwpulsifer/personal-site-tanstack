import { test, expect } from '@playwright/test'
import { ensureHydrated, fillStable } from '../utils/ui'

test.describe('blog listing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog')
    await ensureHydrated(page)
  })

  test('shows seeded published posts', async ({ page }) => {
    await expect(page.getByTestId('post-card-hello-world')).toBeVisible()
    await expect(page.getByTestId('post-card-second-post')).toBeVisible()
  })

  test('hides pending posts from anonymous visitors', async ({ page }) => {
    await expect(page.getByTestId('post-card-draft-post')).not.toBeVisible()
  })

  test('tag filter shows only matching posts', async ({ page }) => {
    await fillStable(page.getByTestId('tag-filter-input'), 'intro')
    await expect(page.getByTestId('post-card-hello-world')).toBeVisible()
    await expect(page.getByTestId('post-card-second-post')).toHaveCount(0)
  })

  test('clear button resets the tag filter', async ({ page }) => {
    await fillStable(page.getByTestId('tag-filter-input'), 'intro')
    await expect(page.getByTestId('post-card-second-post')).toHaveCount(0)
    await page.getByTestId('tag-filter-clear').click()
    await expect(page.getByTestId('post-card-second-post')).toBeVisible()
  })
})

test.describe('individual post', () => {
  test('clicking a post card link navigates to the post', async ({ page }) => {
    await page.goto('/blog')
    await ensureHydrated(page)
    await page.getByTestId('post-link-hello-world').click()
    await expect(page).toHaveURL('/blog/hello-world')
  })

  test('renders post title and markdown content', async ({ page }) => {
    await page.goto('/blog/hello-world')
    await ensureHydrated(page)
    await expect(page.getByTestId('post-title')).toBeVisible()
    await expect(page.getByTestId('post-body')).toContainText('Welcome to the test blog.')
  })
})
