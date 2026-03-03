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

    // The post is now public — navigate to it as anon
    await page.goto(`/blog/${slug}`)
    await expect(page.getByText('Publish Test')).toBeVisible()
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
    await card.getByRole('button', { name: 'Archive' }).click()

    // Reload so the admin query refetches; archived posts move to the details section
    await page.reload()
    await expect(page.getByText(/Archived \(\d+\)/)).toBeVisible()
  })

  test('edit button opens the editor with post data pre-filled', async ({ page }) => {
    await page.goto('/blog')

    const card = page.locator('article').filter({ hasText: 'Hello World' }).first()
    await card.getByRole('button', { name: 'Edit' }).click()

    await expect(page.getByPlaceholder('Post title')).toHaveValue('Hello World')
    await expect(page.getByPlaceholder('post-slug')).toHaveValue('hello-world')

    // Close without saving
    await page.getByRole('button', { name: 'Close editor' }).click()
  })
})
