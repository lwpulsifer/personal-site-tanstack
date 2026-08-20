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
    await fillStable(page.getByTestId('connection-label-input'), 'spouse', 15_000)
    await page.getByTestId('connection-kind-select').selectOption('partner')
    await page.getByTestId('add-connection-btn').click()

    const connectionItem = page.getByTestId('connection-list-item').filter({ hasText: nameA })
    await authExpect(connectionItem).toContainText('spouse', { timeout: 20_000 })
    await authExpect(connectionItem).toContainText(nameB)
    await authExpect(connectionItem).toContainText('partner')

    await connectionItem.getByTestId('delete-connection-btn').click()
    await authExpect(connectionItem).toHaveCount(0, { timeout: 20_000 })

    for (const name of [nameA, nameB]) {
      const personItem = page.getByTestId('person-list-item').filter({ hasText: name })
      page.once('dialog', (dialog) => dialog.accept())
      await personItem.getByTestId('delete-person-btn').click()
      await authExpect(personItem).toHaveCount(0, { timeout: 20_000 })
    }
  })

  test('search jumps to a person and selects them', async ({ page }) => {
    const name = uniqueName('SearchTarget')

    await page.goto('/people')
    await ensureHydrated(page)
    await authExpect(page.getByTestId('people-graph')).toBeVisible({ timeout: 20_000 })

    await fillStable(page.getByTestId('person-name-input'), name, 15_000)
    await page.getByTestId('add-person-btn').click()
    await authExpect(page.getByTestId('person-list')).toContainText(name, { timeout: 20_000 })

    const searchInput = page.getByTestId('people-search-input')
    await fillStable(searchInput, 'SearchTarget', 15_000)
    const result = page.getByTestId('people-search-result').filter({ hasText: name })
    await authExpect(result).toBeVisible({ timeout: 20_000 })
    await result.click()

    await authExpect(searchInput).toHaveValue('')
    await authExpect(page.getByTestId('people-search-results')).toHaveCount(0)
    await authExpect(page.locator('text=Selected:')).toContainText(name)

    // Clean up
    const personItem = page.getByTestId('person-list-item').filter({ hasText: name })
    page.once('dialog', (dialog) => dialog.accept())
    await personItem.getByTestId('delete-person-btn').click()
    await authExpect(personItem).toHaveCount(0, { timeout: 20_000 })
  })

  test('filters the graph to people transitively connected by relationship type', async ({
    page,
  }) => {
    const nameA = uniqueName('FilterA')
    const nameB = uniqueName('FilterB')
    const nameC = uniqueName('FilterC')
    const nameD = uniqueName('FilterD')

    await page.goto('/people')
    await ensureHydrated(page)
    await authExpect(page.getByTestId('people-graph')).toBeVisible({ timeout: 20_000 })

    for (const name of [nameA, nameB, nameC, nameD]) {
      await fillStable(page.getByTestId('person-name-input'), name, 15_000)
      await page.getByTestId('add-person-btn').click()
      await authExpect(page.getByTestId('person-list')).toContainText(name, { timeout: 20_000 })
    }

    // A -friend- B -friend- C (transitively reachable from A), and A -coworker- D
    // (different kind, should be excluded from the "friend" filter).
    async function connect(a: string, b: string, kind: string) {
      await page.getByTestId('connection-person-a-select').selectOption({ label: a })
      await page.getByTestId('connection-person-b-select').selectOption({ label: b })
      await page.getByTestId('connection-kind-select').selectOption(kind)
      await page.getByTestId('add-connection-btn').click()
      const item = page.getByTestId('connection-list-item').filter({ hasText: a })
      await authExpect(item.filter({ hasText: b })).toBeVisible({ timeout: 20_000 })
    }

    await connect(nameA, nameB, 'friend')
    await connect(nameB, nameC, 'friend')
    await connect(nameA, nameD, 'coworker')

    await page.getByTestId('people-filter-person-select').selectOption({ label: nameA })
    await page.getByTestId('people-filter-kind-select').selectOption('friend')
    await page.getByTestId('people-filter-apply-btn').click()

    const searchInput = page.getByTestId('people-search-input')

    // C is reachable transitively via B, so it should still be found in the filtered graph.
    await fillStable(searchInput, 'FilterC', 15_000)
    await authExpect(
      page.getByTestId('people-search-result').filter({ hasText: nameC }),
    ).toBeVisible({ timeout: 20_000 })

    // D is only connected via "coworker", so it should be filtered out.
    await fillStable(searchInput, 'FilterD', 15_000)
    await authExpect(page.getByTestId('people-search-results')).toHaveCount(0)

    await page.getByTestId('people-filter-clear-btn').click()

    // After clearing, D is back.
    await fillStable(searchInput, 'FilterD', 15_000)
    await authExpect(
      page.getByTestId('people-search-result').filter({ hasText: nameD }),
    ).toBeVisible({ timeout: 20_000 })

    // Clean up
    for (const name of [nameA, nameB, nameC, nameD]) {
      const personItem = page.getByTestId('person-list-item').filter({ hasText: name })
      page.once('dialog', (dialog) => dialog.accept())
      await personItem.getByTestId('delete-person-btn').click()
      await authExpect(personItem).toHaveCount(0, { timeout: 20_000 })
    }
  })
})
