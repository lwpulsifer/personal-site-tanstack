import { test as anonTest, expect } from '@playwright/test'
import { test, expect as authExpect } from '../fixtures/auth'
import { ensureHydrated, fillStable } from '../utils/ui'

function uniqueName(label: string) {
  return `E2E ${label} ${Date.now()}`
}

anonTest.describe('people (anonymous)', () => {
  anonTest('visiting /people 404s instead of revealing the page', async ({ page }) => {
    const response = await page.goto('/people')
    expect(response?.status()).toBe(404)
    await ensureHydrated(page)
    await expect(page.getByTestId('people-heading')).toHaveCount(0)
  })
})

test.describe('admin: people graph', () => {
  test('loads the graph page when authenticated', async ({ page }) => {
    await page.goto('/people')
    await ensureHydrated(page)
    await authExpect(page.getByTestId('people-heading')).toBeVisible()
    await authExpect(page.getByTestId('people-graph')).toBeVisible({ timeout: 20_000 })
  })

  test('can add two people, connect them, then delete the connection and both people', async ({
    page,
  }) => {
    const nameA = uniqueName('PersonA')
    const nameB = uniqueName('PersonB')

    await page.goto('/people')
    await ensureHydrated(page)

    await fillStable(page.getByTestId('person-name-input'), nameA, 15_000)
    await page.getByTestId('add-person-btn').click()
    await authExpect(page.getByTestId('person-list')).toContainText(nameA, { timeout: 20_000 })

    await fillStable(page.getByTestId('person-name-input'), nameB, 15_000)
    await page.getByTestId('add-person-btn').click()
    await authExpect(page.getByTestId('person-list')).toContainText(nameB, { timeout: 20_000 })

    await page.getByTestId('connection-person-a-select').selectOption({ label: nameA })
    await page.getByTestId('connection-person-b-select').selectOption({ label: nameB })
    await fillStable(page.getByTestId('connection-label-input'), 'friend', 15_000)
    await page.getByTestId('add-connection-btn').click()

    const connectionItem = page.getByTestId('connection-list-item').filter({ hasText: nameA })
    await authExpect(connectionItem).toContainText('friend', { timeout: 20_000 })
    await authExpect(connectionItem).toContainText(nameB)

    await connectionItem.getByTestId('delete-connection-btn').click()
    await authExpect(connectionItem).toHaveCount(0, { timeout: 20_000 })

    for (const name of [nameA, nameB]) {
      const personItem = page.getByTestId('person-list-item').filter({ hasText: name })
      page.once('dialog', (dialog) => dialog.accept())
      await personItem.getByTestId('delete-person-btn').click()
      await authExpect(personItem).toHaveCount(0, { timeout: 20_000 })
    }
  })
})
