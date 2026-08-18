import { test as anonTest, expect } from '@playwright/test'
import { test, expect as authExpect } from '../fixtures/auth'
import { clickUntilVisible, ensureHydrated, fillStable } from '../utils/ui'

function uniqueTitle(label: string) {
  return `E2E ${label} ${Date.now()}`
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

  test('can add a book and it appears in the feed', async ({ page }) => {
    const title = uniqueTitle('Add')

    await page.goto('/books')
    await ensureHydrated(page)
    await clickUntilVisible(page.getByTestId('new-book-btn'), page.getByTestId('book-editor'), 15_000)

    await fillStable(page.getByTestId('book-title-input'), title, 15_000)
    await fillStable(page.getByTestId('book-author-input'), 'E2E Author', 15_000)
    await page.getByTestId('book-save').click()

    const card = page.locator('[data-testid^="book-card-"]', { hasText: title })
    await authExpect(card).toBeVisible({ timeout: 20_000 })
    await authExpect(card).toContainText('Want to Read')
  })

  test('can move a book through Reading to Read via quick status action', async ({ page }) => {
    const title = uniqueTitle('Status')

    await page.goto('/books')
    await ensureHydrated(page)
    await clickUntilVisible(page.getByTestId('new-book-btn'), page.getByTestId('book-editor'), 15_000)
    await fillStable(page.getByTestId('book-title-input'), title, 15_000)
    await fillStable(page.getByTestId('book-author-input'), 'E2E Author', 15_000)
    await page.getByTestId('book-save').click()

    const card = page.locator('[data-testid^="book-card-"]', { hasText: title })
    await authExpect(card).toBeVisible({ timeout: 20_000 })

    await card.getByTestId('book-next-status').click()
    await authExpect(card).toContainText('Reading', { timeout: 20_000 })

    await card.getByTestId('book-next-status').click()
    await authExpect(card).toContainText('Read', { timeout: 20_000 })

    // Read is an end state — no more one-click quick action, only Edit/Delete.
    await authExpect(card.getByTestId('book-next-status')).toHaveCount(0)
  })

  test('want-to-read books appear in a separate section from reading/read books', async ({ page }) => {
    const title = uniqueTitle('WantSection')

    await page.goto('/books')
    await ensureHydrated(page)
    await clickUntilVisible(page.getByTestId('new-book-btn'), page.getByTestId('book-editor'), 15_000)
    await fillStable(page.getByTestId('book-title-input'), title, 15_000)
    await fillStable(page.getByTestId('book-author-input'), 'E2E Author', 15_000)
    await page.getByTestId('book-save').click()

    const card = page.locator('[data-testid^="book-card-"]', { hasText: title })
    await authExpect(card).toBeVisible({ timeout: 20_000 })

    const wantToReadHeading = page.getByTestId('want-to-read-heading')
    await authExpect(wantToReadHeading).toBeVisible()

    // The card should come after the "Want to Read" section heading in DOM order.
    const cardTestId = await card.getAttribute('data-testid')
    const elements = await page
      .locator('[data-testid^="book-card-"], [data-testid="want-to-read-heading"]')
      .all()
    const testIds = await Promise.all(elements.map((el) => el.getAttribute('data-testid')))
    const headingIndex = testIds.indexOf('want-to-read-heading')
    const cardIndex = testIds.indexOf(cardTestId)
    expect(cardIndex).toBeGreaterThan(headingIndex)
  })

  test('reading books are listed above read books regardless of date', async ({ page }) => {
    const readingTitle = uniqueTitle('OrderReading')
    const readTitle = uniqueTitle('OrderRead')

    // Create and mark the "read" book first, then the "reading" one — if
    // ordering were purely by date, "read" would sort above "reading".
    await page.goto('/books')
    await ensureHydrated(page)

    await clickUntilVisible(page.getByTestId('new-book-btn'), page.getByTestId('book-editor'), 15_000)
    await fillStable(page.getByTestId('book-title-input'), readTitle, 15_000)
    await fillStable(page.getByTestId('book-author-input'), 'E2E Author', 15_000)
    await page.getByTestId('book-save').click()
    const readCard = page.locator('[data-testid^="book-card-"]', { hasText: readTitle })
    await authExpect(readCard).toBeVisible({ timeout: 20_000 })
    await readCard.getByTestId('book-next-status').click()
    await authExpect(readCard).toContainText('Reading', { timeout: 20_000 })
    await readCard.getByTestId('book-next-status').click()
    await authExpect(readCard).toContainText('Read', { timeout: 20_000 })

    await clickUntilVisible(page.getByTestId('new-book-btn'), page.getByTestId('book-editor'), 15_000)
    await fillStable(page.getByTestId('book-title-input'), readingTitle, 15_000)
    await fillStable(page.getByTestId('book-author-input'), 'E2E Author', 15_000)
    await page.getByTestId('book-save').click()
    const readingCard = page.locator('[data-testid^="book-card-"]', { hasText: readingTitle })
    await authExpect(readingCard).toBeVisible({ timeout: 20_000 })
    await readingCard.getByTestId('book-next-status').click()
    await authExpect(readingCard).toContainText('Reading', { timeout: 20_000 })

    // Compare DOM order rather than pixel position, since the grid is
    // two columns and same-row cards can share a y-coordinate.
    const readingTestId = await readingCard.getAttribute('data-testid')
    const readTestId = await readCard.getAttribute('data-testid')
    const elements = await page
      .getByTestId('primary-books')
      .locator('[data-testid^="book-card-"]')
      .all()
    const testIds = await Promise.all(elements.map((el) => el.getAttribute('data-testid')))
    expect(testIds.indexOf(readingTestId)).toBeLessThan(testIds.indexOf(readTestId))

    // Clean up: move the reading book to read so global teardown can find both by title.
    await readingCard.getByTestId('book-next-status').click()
  })

  test('edit button opens the editor with book data pre-filled', async ({ page }) => {
    const title = uniqueTitle('Edit')

    await page.goto('/books')
    await ensureHydrated(page)
    await clickUntilVisible(page.getByTestId('new-book-btn'), page.getByTestId('book-editor'), 15_000)
    await fillStable(page.getByTestId('book-title-input'), title, 15_000)
    await fillStable(page.getByTestId('book-author-input'), 'E2E Author', 15_000)
    await page.getByTestId('book-save').click()

    const card = page.locator('[data-testid^="book-card-"]', { hasText: title })
    await authExpect(card).toBeVisible({ timeout: 20_000 })

    await card.getByTestId('book-edit').click()
    await authExpect(page.getByTestId('book-editor')).toBeVisible({ timeout: 20_000 })
    await authExpect(page.getByTestId('book-title-input')).toHaveValue(title)
    await authExpect(page.getByTestId('book-author-input')).toHaveValue('E2E Author')

    // Clean up via delete so it doesn't leak into other tests
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId('book-editor').getByRole('button', { name: 'Delete' }).click()
    await authExpect(card).toHaveCount(0, { timeout: 20_000 })
  })

  test('can delete a book from the card', async ({ page }) => {
    const title = uniqueTitle('Delete')

    await page.goto('/books')
    await ensureHydrated(page)
    await clickUntilVisible(page.getByTestId('new-book-btn'), page.getByTestId('book-editor'), 15_000)
    await fillStable(page.getByTestId('book-title-input'), title, 15_000)
    await fillStable(page.getByTestId('book-author-input'), 'E2E Author', 15_000)
    await page.getByTestId('book-save').click()

    const card = page.locator('[data-testid^="book-card-"]', { hasText: title })
    await authExpect(card).toBeVisible({ timeout: 20_000 })

    page.once('dialog', (dialog) => dialog.accept())
    await card.getByTestId('book-delete').click()
    await authExpect(card).toHaveCount(0, { timeout: 20_000 })
  })
})
