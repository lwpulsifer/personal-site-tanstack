import { test, expect } from '../fixtures/auth'
import { clickUntilVisible, ensureHydrated, fillStable } from '../utils/ui'

// Each test gets a unique slug so they don't collide and teardown can batch-delete them.
function uniqueSlug(label: string) {
  return `e2e-test-${label}-${Date.now()}`
}

test.describe('admin: post management', () => {
  test('shows "+ New Post" button when authenticated', async ({ page }) => {
    await page.goto('/blog')
    await ensureHydrated(page)
    await expect(page.getByTestId('new-post-btn')).toBeVisible()
  })

  test('can create a draft post', async ({ page }) => {
    const slug = uniqueSlug('draft')
    const title = `E2E Draft ${slug}`

    await page.goto('/blog')
    await ensureHydrated(page)
    await clickUntilVisible(page.getByTestId('new-post-btn'), page.getByTestId('post-editor'), 15_000)

    await fillStable(page.getByTestId('post-editor-title'), title, 15_000)
    await fillStable(page.getByTestId('post-editor-slug'), slug, 15_000)
    await fillStable(page.getByTestId('post-editor-content'), '# Draft\n\nCreated by e2e test.', 15_000)

    await page.getByTestId('post-editor-save').click()

    // Editor closes on save; the new post should appear in the admin list
    await expect(page.getByTestId(`post-card-${slug}`)).toBeVisible({ timeout: 20_000 })
  })

  test('can publish a post via the post card', async ({ page }) => {
    const slug = uniqueSlug('publish')
    const title = `E2E Publish ${slug}`

    await page.goto('/blog')
    await ensureHydrated(page)
    await clickUntilVisible(page.getByTestId('new-post-btn'), page.getByTestId('post-editor'), 15_000)
    await fillStable(page.getByTestId('post-editor-title'), title, 15_000)
    await fillStable(page.getByTestId('post-editor-slug'), slug, 15_000)
    await fillStable(page.getByTestId('post-editor-content'), '# Publish Test\n\nE2E post to publish.', 15_000)
    await page.getByTestId('post-editor-save').click()

    await expect(page.getByTestId(`post-card-${slug}`)).toBeVisible({ timeout: 20_000 })
    await page.getByTestId(`post-publish-btn-${slug}`).click()
    await expect(page.getByTestId(`post-archive-btn-${slug}`)).toBeVisible({ timeout: 20_000 })

    // The post is now public — navigate to it
    await page.goto(`/blog/${slug}`)
    await ensureHydrated(page)
    await expect(page.getByTestId('post-title')).toHaveText(title)

    // Clean up: archive the post so it doesn't leak into other tests (e.g. sitemap)
    await page.goto('/blog')
    await ensureHydrated(page)
    await page.getByTestId(`post-archive-btn-${slug}`).click()
    await expect(page.getByTestId(`post-archive-btn-${slug}`)).not.toBeVisible({ timeout: 20_000 })
  })

  test('can archive a published post', async ({ page }) => {
    const slug = uniqueSlug('archive')
    const title = `E2E Archive ${slug}`

    await page.goto('/blog')
    await ensureHydrated(page)
    await clickUntilVisible(page.getByTestId('new-post-btn'), page.getByTestId('post-editor'), 15_000)
    await fillStable(page.getByTestId('post-editor-title'), title, 15_000)
    await fillStable(page.getByTestId('post-editor-slug'), slug, 15_000)
    await fillStable(page.getByTestId('post-editor-content'), '# Archive Test', 15_000)
    await page.getByTestId('post-editor-save').click()

    await expect(page.getByTestId(`post-card-${slug}`)).toBeVisible({ timeout: 20_000 })
    await page.getByTestId(`post-publish-btn-${slug}`).click()
    await expect(page.getByTestId(`post-archive-btn-${slug}`)).toBeVisible({ timeout: 20_000 })

    await page.getByTestId(`post-archive-btn-${slug}`).click()
    // After archive mutation completes and the query refetches, the post moves
    // from the active grid into a collapsed <details> section — no longer visible.
    await expect(page.getByTestId(`post-archive-btn-${slug}`)).not.toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('archived-posts-summary')).toBeVisible()
  })

  test('edit button opens the editor with post data pre-filled', async ({ page }) => {
    await page.goto('/blog')

    // Wait for admin query to resolve before looking for Edit buttons
    await ensureHydrated(page)
    await expect(page.getByTestId('new-post-btn')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('post-edit-btn-hello-world').click()
    await expect(page.getByTestId('post-editor')).toBeVisible({ timeout: 20_000 })

    await expect(page.getByTestId('post-editor-title')).toHaveValue('Hello World')
    await expect(page.getByTestId('post-editor-slug')).toHaveValue('hello-world')

    // Close without saving
    await page.getByTestId('post-editor-close').click()
  })
})
