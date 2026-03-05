import { test, expect } from '../fixtures/auth'

// Each test gets a unique slug so they don't collide and teardown can batch-delete them.
function uniqueSlug(label: string) {
  return `e2e-test-${label}-${Date.now()}`
}

test.describe('admin: post management', () => {
  test('shows "+ New Post" button when authenticated', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByRole('button', { name: '+ New Post' })).toBeVisible()
  })

  test('can create a draft post', async ({ page }) => {
    const slug = uniqueSlug('draft')
    const title = `E2E Draft ${slug}`

    await page.goto('/blog')
    await page.getByRole('button', { name: '+ New Post' }).click()
    await expect(page.getByPlaceholder('Post title')).toBeVisible()

    await page.getByPlaceholder('Post title').fill(title)
    await page.getByPlaceholder('post-slug').clear()
    await page.getByPlaceholder('post-slug').fill(slug)
    await page.getByPlaceholder('Write your post in Markdown…').fill('# Draft\n\nCreated by e2e test.')

    await page.getByRole('button', { name: 'Save' }).click()

    // Editor closes on save; the new post should appear in the admin list
    await expect(page.getByText(title)).toBeVisible()
  })

  test('can publish a post via the post card', async ({ page }) => {
    const slug = uniqueSlug('publish')
    const title = `E2E Publish ${slug}`

    await page.goto('/blog')
    await page.getByRole('button', { name: '+ New Post' }).click()
    await page.getByPlaceholder('Post title').fill(title)
    await page.getByPlaceholder('post-slug').clear()
    await page.getByPlaceholder('post-slug').fill(slug)
    await page.getByPlaceholder('Write your post in Markdown…').fill('# Publish Test\n\nE2E post to publish.')
    await page.getByRole('button', { name: 'Save' }).click()

    // AdminActions on the card has a Publish button for non-published posts
    const card = page.locator('article').filter({ hasText: title })
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Publish' }).click()

    // Wait for the mutation to complete — Archive replaces Publish on success
    await expect(card.getByRole('button', { name: 'Archive' })).toBeVisible()

    // The post is now public — navigate to it
    await page.goto(`/blog/${slug}`)
    await expect(page.getByRole('heading', { name: title }).first()).toBeVisible()

    // Clean up: archive the post so it doesn't leak into other tests (e.g. sitemap)
    await page.goto('/blog')
    const card = page.locator('article').filter({ hasText: title })
    await card.getByRole('button', { name: 'Archive' }).click()
    await expect(card.getByRole('button', { name: 'Archive' })).not.toBeVisible({ timeout: 10_000 })
  })

  test('can archive a published post', async ({ page }) => {
    const slug = uniqueSlug('archive')
    const title = `E2E Archive ${slug}`

    await page.goto('/blog')
    await page.getByRole('button', { name: '+ New Post' }).click()
    await page.getByPlaceholder('Post title').fill(title)
    await page.getByPlaceholder('post-slug').clear()
    await page.getByPlaceholder('post-slug').fill(slug)
    await page.getByPlaceholder('Write your post in Markdown…').fill('# Archive Test')
    await page.getByRole('button', { name: 'Save' }).click()

    const card = page.locator('article').filter({ hasText: title })
    await card.getByRole('button', { name: 'Publish' }).click()
    // Wait for publish to complete
    await expect(card.getByRole('button', { name: 'Archive' })).toBeVisible()

    await card.getByRole('button', { name: 'Archive' }).click()
    // After archive mutation completes and the query refetches, the post moves
    // from the active grid into a collapsed <details> section — no longer visible.
    await expect(card.getByRole('button', { name: 'Archive' })).not.toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Archived \(\d+\)/)).toBeVisible()
  })

  test('edit button opens the editor with post data pre-filled', async ({ page }) => {
    await page.goto('/blog')

    // Wait for admin query to resolve and Edit buttons to appear
    const card = page.locator('article').filter({ hasText: 'Hello World' }).first()
    await expect(card.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 10_000 })
    await card.getByRole('button', { name: 'Edit' }).click()

    await expect(page.getByPlaceholder('Post title')).toHaveValue('Hello World')
    await expect(page.getByPlaceholder('post-slug')).toHaveValue('hello-world')

    // Close without saving
    await page.getByRole('button', { name: 'Close editor' }).click()
  })
})
