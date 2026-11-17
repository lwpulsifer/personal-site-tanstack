import { test as anonTest, expect } from '@playwright/test'
import { test } from '../fixtures/auth'
import { ensureHydrated, fillStable } from '../utils/ui'

const keyword = `e2e-gifts-${Date.now()}`
const items = [
  { secret: 'Kindle', description: 'Something to read with' },
  { secret: 'Espresso machine', description: 'A morning upgrade' },
  { secret: 'Hiking boots', description: 'For getting outside' },
  { secret: 'Concert tickets', description: 'A night out' },
]
let adminQuizUrl = ''

test.describe.configure({ mode: 'serial' })

test('admin creates a quiz', async ({ page }) => {
  await page.goto('/quizzes/admin/new')
  await ensureHydrated(page)
  await fillStable(page.getByTestId('quiz-title-input'), 'Gift ranking')
  await fillStable(page.getByTestId('quiz-keyword-input'), keyword)

  // Editor starts with two blank rows; add two more.
  await page.getByTestId('quiz-add-item').click()
  await page.getByTestId('quiz-add-item').click()
  for (const [i, item] of items.entries()) {
    await page.getByLabel(`Item ${i + 1} secret label`).fill(item.secret)
    await page.getByLabel(`Item ${i + 1} description`).fill(item.description)
  }

  // Paste an image into item 1's description field — it should upload to
  // storage and become that item's picture.
  await page.getByLabel('Item 1 description').evaluate((el) => {
    // 1x1 red PNG
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const data = new DataTransfer()
    data.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }))
    el.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
  await expect(page.getByLabel('Item 1 image URL')).toHaveValue(
    /\/storage\/v1\/object\/public\/quiz-images\//,
    { timeout: 15_000 },
  )
  // The text field itself must not have received anything.
  await expect(page.getByLabel('Item 1 description')).toHaveValue(
    items[0].description,
  )

  await page.getByTestId('quiz-save').click()

  await expect(page).toHaveURL(/\/quizzes\/admin\/[0-9a-f-]{36}$/, {
    timeout: 20_000,
  })
  await expect(page.getByTestId('quiz-no-responses')).toBeVisible()
  adminQuizUrl = page.url()
})

anonTest('wrong keyword shows not-found', async ({ page }) => {
  await page.goto('/quizzes')
  await ensureHydrated(page)
  await fillStable(page.getByTestId('quiz-keyword-entry'), 'definitely-not-a-quiz')
  await page.getByRole('button', { name: 'Go' }).click()
  await expect(page.getByTestId('quiz-not-found')).toBeVisible({
    timeout: 15_000,
  })
})

anonTest('visitor ranks items and sees thanks', async ({ page }) => {
  await page.goto('/quizzes')
  await ensureHydrated(page)
  // Keyword matching is case-insensitive.
  await fillStable(page.getByTestId('quiz-keyword-entry'), keyword.toUpperCase())
  await page.getByRole('button', { name: 'Go' }).click()

  await expect(page.getByText('Gift ranking')).toBeVisible({ timeout: 15_000 })
  // Visitors must never see the admin-only labels.
  for (const item of items) {
    await expect(page.getByText(item.secret)).toHaveCount(0)
  }
  await page.getByTestId('quiz-name-input').fill('E2E Visitor')
  await page.getByTestId('quiz-start').click()

  // Always prefer the item that comes earliest in `items`.
  const rank = (text: string) =>
    items.findIndex((i) => text.includes(i.description))
  const thanks = page.getByTestId('quiz-thanks')
  const options = page.getByTestId('quiz-option')
  for (let step = 0; step < 20; step++) {
    // Wait for either the next comparison or the end screen.
    await expect(options.first().or(thanks)).toBeVisible({ timeout: 10_000 })
    if (await thanks.isVisible()) break
    await expect(options).toHaveCount(2)
    const [a, b] = await options.allInnerTexts()
    await options.nth(rank(a) < rank(b) ? 0 : 1).click()
  }
  await expect(page.getByTestId('quiz-thanks')).toBeVisible({ timeout: 15_000 })
})

test('admin sees the total ordering', async ({ page }) => {
  await page.goto(adminQuizUrl)
  await ensureHydrated(page)
  const response = page.getByTestId('quiz-response')
  await expect(response).toHaveCount(1, { timeout: 15_000 })
  await expect(response).toContainText('E2E Visitor')
  const ranked = await response
    .getByTestId('quiz-result-label')
    .allInnerTexts()
  expect(ranked).toEqual(items.map((i) => i.secret))
  await expect(response.locator('img[src*="quiz-images"]')).toHaveCount(1)
})
