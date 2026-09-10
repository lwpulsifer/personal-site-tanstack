import { test as anonTest, expect, type Locator, type Page } from '@playwright/test'
import { test, expect as authExpect } from '../fixtures/auth'
import { clickUntilVisible, ensureHydrated, fillStable } from '../utils/ui'

function uniqueTitle(label: string) {
  return `E2E ${label} ${Date.now()}`
}

async function saveNewBook(page: Page, title: string) {
  await clickUntilVisible(page.getByTestId('new-book-btn'), page.getByTestId('book-editor'), 15_000)
  await fillStable(page.getByTestId('book-title-input'), title, 15_000)
  await fillStable(page.getByTestId('book-author-input'), 'E2E Author', 15_000)
  await page.getByTestId('book-save').click()
}

// Expands a shelf (idempotently — a no-op if it's already open). Works for
// any shelf, not just Want to Read, since future tests may need to open a
// different collapsed shelf.
async function ensureShelfOpen(page: Page, shelfKey: string, timeoutMs = 20_000) {
  const stack = page.getByTestId(`shelf-stack-${shelfKey}`)
  const grid = page.getByTestId(`shelf-books-${shelfKey}`)
  await stack.or(grid).waitFor({ state: 'visible', timeout: timeoutMs })
  if (await stack.isVisible().catch(() => false)) {
    await clickUntilVisible(stack, grid, timeoutMs)
  }
}

// New books always land in Want to Read, which starts collapsed as a stack —
// expand it so the card is actually in the DOM to find.
async function addBook(page: Page, title: string) {
  await saveNewBook(page, title)
  await ensureShelfOpen(page, 'want_to_read')
  const card = page.locator('[data-testid^="book-card-"]', { hasText: title })
  await expect(card).toBeVisible({ timeout: 20_000 })
  return card
}

// Clicks a shelf card and waits for its own page to load, returning that
// page's container locator (scoped so admin-action lookups don't ambiguously
// match anything else on the page).
async function openBookPage(page: Page, card: Locator) {
  await card.click()
  const bookPage = page.getByTestId('book-page')
  await authExpect(bookPage).toBeVisible({ timeout: 20_000 })
  return bookPage
}

async function deleteBookFromShelf(page: Page, shelfKey: string, title: string) {
  await page
    .getByTestId(`shelf-books-${shelfKey}`)
    .locator('[data-testid^="book-card-"]', { hasText: title })
    .click()
  const bookPage = page.getByTestId('book-page')
  await authExpect(bookPage).toBeVisible({ timeout: 20_000 })
  page.once('dialog', (dialog) => dialog.accept())
  await bookPage.getByTestId('book-delete').click()
  await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })
}

anonTest.describe('books listing (anonymous)', () => {
  anonTest('renders the page without the admin controls', async ({ page }) => {
    await page.goto('/books')
    await ensureHydrated(page)
    await expect(page.getByTestId('books-heading')).toBeVisible()
    await expect(page.getByTestId('new-book-btn')).toHaveCount(0)
  })
})

test.describe('admin: book management', () => {
  test('shows "+ Add Book" button when authenticated', async ({ page }) => {
    await page.goto('/books')
    await ensureHydrated(page)
    await authExpect(page.getByTestId('new-book-btn')).toBeVisible()
  })

  test('Want to Read starts as a collapsed stack; Reading and Read start expanded', async ({ page }) => {
    const title = uniqueTitle('ShelfDefaults')

    await page.goto('/books')
    await ensureHydrated(page)
    await saveNewBook(page, title)

    // Freshly saved book is Want to Read — the shelf should show a
    // collapsed stack, not the expanded grid, without any interaction.
    await authExpect(page.getByTestId('shelf-stack-want_to_read')).toBeVisible({ timeout: 20_000 })
    await authExpect(page.getByTestId('shelf-books-want_to_read')).toHaveCount(0)

    await ensureShelfOpen(page, 'want_to_read')
    const card = page.locator('[data-testid^="book-card-"]', { hasText: title })
    await authExpect(card).toBeVisible()

    // Move it to Reading, then head back to the shelf — that shelf's grid
    // should already be visible, no click needed to expand it.
    const bookPage = await openBookPage(page, card)
    await bookPage.getByTestId('book-next-status').click()
    await authExpect(bookPage).toContainText('Reading', { timeout: 20_000 })
    await page.getByTestId('book-back-link').click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })

    await authExpect(page.getByTestId('shelf-books-reading')).toBeVisible()
    await authExpect(
      page.getByTestId('shelf-books-reading').locator('[data-testid^="book-card-"]', { hasText: title }),
    ).toBeVisible({ timeout: 20_000 })

    await deleteBookFromShelf(page, 'reading', title)
  })

  test('can add a book and it appears on its own page', async ({ page }) => {
    const title = uniqueTitle('Add')

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)

    const bookPage = await openBookPage(page, card)
    await authExpect(bookPage).toContainText('Want to Read')
  })

  test('cover tile shows only image, title, author, and rating', async ({ page }) => {
    const title = uniqueTitle('CoverTile')

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)

    await authExpect(card).toContainText(title)
    await authExpect(card).toContainText('E2E Author')
    // No status badge or review text on the tile itself.
    await authExpect(card).not.toContainText('Want to Read')
  })

  test('a book\'s own page is directly shareable via its URL', async ({ page }) => {
    const title = uniqueTitle('Shareable')

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)
    const bookPage = await openBookPage(page, card)
    await authExpect(bookPage.getByTestId('book-copy-link-btn')).toBeVisible()
    const url = page.url()

    // Simulate someone opening the shared link fresh — a full navigation
    // with no prior in-app state, not a client-side route change.
    await page.goto(url)
    await ensureHydrated(page)
    await authExpect(page.getByTestId('book-page-title')).toHaveText(title)

    // Clean up
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId('book-delete').click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })
  })

  test('viewing a book\'s page shows the full review', async ({ page }) => {
    const title = uniqueTitle('Detail')
    const longReview = 'This is a long review. '.repeat(10).trim()

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)
    const bookPage = await openBookPage(page, card)

    await bookPage.getByTestId('book-edit').click()
    await authExpect(page.getByTestId('book-editor')).toBeVisible({ timeout: 20_000 })
    await fillStable(page.getByTestId('book-review-input'), longReview, 15_000)
    await page.getByTestId('book-save').click()

    await authExpect(page.getByTestId('book-page-review')).toHaveText(longReview, { timeout: 20_000 })

    // Clean up
    page.once('dialog', (dialog) => dialog.accept())
    await bookPage.getByTestId('book-delete').click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })
  })

  test('can move a book through Reading to Read via quick status action on its page', async ({ page }) => {
    const title = uniqueTitle('Status')

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)
    const bookPage = await openBookPage(page, card)

    await bookPage.getByTestId('book-next-status').click()
    await authExpect(bookPage).toContainText('Reading', { timeout: 20_000 })

    await bookPage.getByTestId('book-next-status').click()
    await authExpect(bookPage).toContainText('Read', { timeout: 20_000 })

    // Read is an end state — no more one-click quick action, only Edit/Delete.
    await authExpect(bookPage.getByTestId('book-next-status')).toHaveCount(0)
  })

  test('reading shelf appears above the read shelf, above want to read', async ({ page }) => {
    const readingTitle = uniqueTitle('OrderReading')
    const readTitle = uniqueTitle('OrderRead')
    const wantTitle = uniqueTitle('OrderWant')

    await page.goto('/books')
    await ensureHydrated(page)

    const readCard = await addBook(page, readTitle)
    let bookPage = await openBookPage(page, readCard)
    await bookPage.getByTestId('book-next-status').click()
    await authExpect(bookPage).toContainText('Reading', { timeout: 20_000 })
    await bookPage.getByTestId('book-next-status').click()
    await authExpect(bookPage).toContainText('Read', { timeout: 20_000 })
    await page.getByTestId('book-back-link').click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })

    const readingCard = await addBook(page, readingTitle)
    bookPage = await openBookPage(page, readingCard)
    await bookPage.getByTestId('book-next-status').click()
    await authExpect(bookPage).toContainText('Reading', { timeout: 20_000 })
    await page.getByTestId('book-back-link').click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })

    await addBook(page, wantTitle)

    const shelfHeadings = await page
      .locator('[data-testid^="shelf-toggle-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))
    expect(shelfHeadings).toEqual([
      'shelf-toggle-reading',
      'shelf-toggle-read',
      'shelf-toggle-want_to_read',
    ])

    // Clean up
    await deleteBookFromShelf(page, 'reading', readingTitle)
    await deleteBookFromShelf(page, 'read', readTitle)
  })

  test('edit button opens the editor with book data pre-filled', async ({ page }) => {
    const title = uniqueTitle('Edit')

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)
    const bookPage = await openBookPage(page, card)

    await bookPage.getByTestId('book-edit').click()
    await authExpect(page.getByTestId('book-editor')).toBeVisible({ timeout: 20_000 })
    await authExpect(page.getByTestId('book-title-input')).toHaveValue(title)
    await authExpect(page.getByTestId('book-author-input')).toHaveValue('E2E Author')

    // Clean up via delete so it doesn't leak into other tests
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId('book-editor').getByRole('button', { name: 'Delete' }).click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })
  })

  test('cover recovers after a broken cover URL is fixed via edit', async ({ page }) => {
    const title = uniqueTitle('CoverRecovery')
    const brokenUrl = 'https://example.com/e2e-broken-cover.jpg'
    const fixedUrl = 'https://example.com/e2e-fixed-cover.jpg'
    const onePixelPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )

    await page.route(brokenUrl, (route) => route.fulfill({ status: 404 }))
    await page.route(fixedUrl, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng }),
    )

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)
    const bookPage = await openBookPage(page, card)
    const editor = page.getByTestId('book-editor')

    // Point the book at a cover URL that will fail to load.
    await bookPage.getByTestId('book-edit').click()
    await authExpect(editor).toBeVisible({ timeout: 20_000 })
    await fillStable(editor.getByTestId('book-cover-input'), brokenUrl, 15_000)
    await editor.getByTestId('book-save').click()
    await authExpect(editor).toHaveCount(0, { timeout: 20_000 })

    // Broken cover -> placeholder icon, no <img>. Checked against the book
    // page's own cover, which stays mounted across this edit (unlike the
    // shelf card, which unmounts when navigating away).
    await authExpect(bookPage.getByTestId('cover-placeholder')).toBeVisible({ timeout: 20_000 })
    await authExpect(bookPage.getByTestId('cover-image')).toHaveCount(0)

    // Fix the cover URL via a second edit — same book, same CoverImage
    // instance (never remounts), so this exercises the exact case that
    // used to get stuck showing the placeholder forever.
    await bookPage.getByTestId('book-edit').click()
    await authExpect(editor).toBeVisible({ timeout: 20_000 })
    await fillStable(editor.getByTestId('book-cover-input'), fixedUrl, 15_000)
    await editor.getByTestId('book-save').click()
    await authExpect(editor).toHaveCount(0, { timeout: 20_000 })

    await authExpect(bookPage.getByTestId('cover-image')).toBeVisible({ timeout: 20_000 })
    await authExpect(bookPage.getByTestId('cover-image')).toHaveAttribute('src', fixedUrl)
    await authExpect(bookPage.getByTestId('cover-placeholder')).toHaveCount(0)

    // Clean up
    page.once('dialog', (dialog) => dialog.accept())
    await bookPage.getByTestId('book-delete').click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })
  })

  test('can delete a book from its own page', async ({ page }) => {
    const title = uniqueTitle('Delete')

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)
    const bookPage = await openBookPage(page, card)

    page.once('dialog', (dialog) => dialog.accept())
    await bookPage.getByTestId('book-delete').click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })
    await authExpect(card).toHaveCount(0, { timeout: 20_000 })
  })

  test('an anonymous comment is visible only to its author and the admin until approved', async ({
    page,
    browser,
  }) => {
    const title = uniqueTitle('Comments')
    const commenterName = uniqueTitle('Commenter')
    const commentBody = `E2E comment body ${Date.now()}`

    await page.goto('/books')
    await ensureHydrated(page)
    const card = await addBook(page, title)
    const bookPage = await openBookPage(page, card)
    const bookUrl = page.url()

    // Anonymous author, in a separate browser context (own cookies).
    const authorContext = await browser.newContext()
    const authorPage = await authorContext.newPage()
    await authorPage.goto(bookUrl)
    await ensureHydrated(authorPage)
    await fillStable(
      authorPage.getByTestId('book-comment-name-input'),
      commenterName,
      15_000,
    )
    await fillStable(
      authorPage.getByTestId('book-comment-body-input'),
      commentBody,
      15_000,
    )
    await authorPage.getByTestId('book-comment-submit').click()

    const ownComment = authorPage.locator('[data-testid^="book-comment-item-"]', {
      hasText: commentBody,
    })
    await expect(ownComment).toBeVisible({ timeout: 20_000 })
    await expect(ownComment).toContainText('only visible to you')

    // A different anonymous visitor must not see the pending comment yet.
    const strangerContext = await browser.newContext()
    const strangerPage = await strangerContext.newPage()
    await strangerPage.goto(bookUrl)
    await ensureHydrated(strangerPage)
    await expect(
      strangerPage.locator('[data-testid^="book-comment-item-"]', {
        hasText: commentBody,
      }),
    ).toHaveCount(0)

    // Admin sees it pending after a refresh, both on the book page and via
    // the header notification panel.
    await page.reload()
    await ensureHydrated(page)
    await authExpect(
      page.locator('[data-testid^="book-comment-item-"]', { hasText: commentBody }),
    ).toBeVisible({ timeout: 20_000 })

    await authExpect(page.getByTestId('pending-comments-badge')).toBeVisible({
      timeout: 20_000,
    })
    await page.getByTestId('pending-comments-badge').click()
    const pendingRow = page.locator('[data-testid^="pending-comment-"]', {
      hasText: commentBody,
    })
    await authExpect(pendingRow).toBeVisible({ timeout: 20_000 })
    await pendingRow.locator('[data-testid^="pending-comment-approve-"]').click()
    await authExpect(pendingRow).toHaveCount(0, { timeout: 20_000 })

    // Approved — now visible to the original stranger too.
    await strangerPage.reload()
    await ensureHydrated(strangerPage)
    const publicComment = strangerPage.locator(
      '[data-testid^="book-comment-item-"]',
      { hasText: commentBody },
    )
    await expect(publicComment).toBeVisible({ timeout: 20_000 })
    await expect(publicComment).not.toContainText('only visible to you')

    await authorContext.close()
    await strangerContext.close()

    // Clean up
    page.once('dialog', (dialog) => dialog.accept())
    await bookPage.getByTestId('book-delete').click()
    await authExpect(page.getByTestId('books-heading')).toBeVisible({ timeout: 20_000 })
  })
})
