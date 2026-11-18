import { expect, test } from '@playwright/test'
import { ensureHydrated } from '../utils/ui'

// Optimistic navigation (src/lib/navigation.ts). Solid's router holds the old page
// until the next route's data settles; the navbar must respond on the click itself.
// The testids exist only in the Solid app (the default e2e target).
test.skip(process.env.E2E_TARGET === 'react', 'Solid-only testids')

test('a nav link responds immediately while the next route is still loading', async ({ page }) => {
  const warnings: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text())
  })

  await page.goto('/')
  await ensureHydrated(page)
  await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page')

  // Hold every server-function response so the destination's data is "slow".
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(/\/_server/, async (route) => {
    await gate
    await route.continue()
  })

  await page.getByTestId('nav-books').click()

  // Before any data has arrived: the clicked link is already the active one...
  await expect(page.getByTestId('nav-books')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('nav-home')).not.toHaveAttribute('aria-current', 'page')
  // ...there's visible progress, and the old page is dimmed, not yet replaced.
  await expect(page.getByTestId('nav-progress')).toBeVisible()
  await expect(page.getByTestId('route-content')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByTestId('books-heading')).toHaveCount(0)

  // Once the data arrives the new page replaces it and the feedback clears.
  release()
  await expect(page.getByTestId('books-heading')).toBeVisible()
  await expect(page.getByTestId('nav-progress')).toHaveCount(0)
  await expect(page.getByTestId('route-content')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByTestId('nav-books')).toHaveAttribute('aria-current', 'page')

  // Dev builds warn (SILENT_HOLD) when a held navigation shows nothing for the wait.
  expect(warnings.filter((w) => w.includes('SILENT_HOLD'))).toEqual([])
})

test('the active link tracks nested routes and follows back/forward', async ({ page }) => {
  await page.goto('/blog')
  await ensureHydrated(page)
  await expect(page.getByTestId('nav-blog')).toHaveAttribute('aria-current', 'page')

  await page.getByTestId('post-link-hello-world').click()
  await expect(page).toHaveURL(/\/blog\/hello-world$/)
  // /blog/hello-world is under /blog, so Blog stays active and Home does not.
  await expect(page.getByTestId('nav-blog')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('nav-home')).not.toHaveAttribute('aria-current', 'page')

  await page.goBack()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.getByTestId('nav-blog')).toHaveAttribute('aria-current', 'page')

  await page.getByTestId('nav-home').click()
  await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('nav-blog')).not.toHaveAttribute('aria-current', 'page')
})

test('the footer view count never holds a navigation', async ({ page }) => {
  await page.goto('/')
  await ensureHydrated(page)

  // Hold only the footer's page-view count for the next route. Solid holds a route
  // transition until every async read it triggers settles, unless that read sits in a
  // boundary re-armed by the path (<Loading on=...> in PageViewsTracker).
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(/getPageViews/, async (route) => {
    await gate
    await route.continue()
  })

  // Hover first so the books data is preloaded, as it is for a real user.
  await page.getByTestId('nav-books').hover()
  await page.getByTestId('nav-books').click()

  // The new page appears even though the footer's fetch is still outstanding.
  await expect(page.getByTestId('books-heading')).toBeVisible()
  await expect(page.getByTestId('route-content')).toHaveAttribute('aria-busy', 'false')
  release()
})
