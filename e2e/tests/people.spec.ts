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

  test('can edit a person and a connection', async ({ page }) => {
    const nameA = uniqueName('EditA')
    const nameB = uniqueName('EditB')
    const nameC = uniqueName('EditC')
    const renamedA = uniqueName('EditARenamed')

    await page.goto('/people')
    await ensureHydrated(page)

    for (const name of [nameA, nameB, nameC]) {
      await fillStable(page.getByTestId('person-name-input'), name, 15_000)
      await page.getByTestId('add-person-btn').click()
      await authExpect(page.getByTestId('person-list')).toContainText(name, { timeout: 20_000 })
    }

    // Edit the person's name.
    const personItem = page.getByTestId('person-list-item').filter({ hasText: nameA })
    await personItem.getByTestId('edit-person-btn').click()
    await fillStable(page.getByTestId('person-edit-name-input'), renamedA, 15_000)
    await page.getByTestId('save-person-btn').click()
    await authExpect(page.getByTestId('person-list')).toContainText(renamedA, {
      timeout: 20_000,
    })
    await authExpect(page.getByTestId('person-list')).not.toContainText(nameA)

    // Add a connection, then edit its kind, comment, and other person.
    await page.getByTestId('connection-person-a-select').selectOption({ label: renamedA })
    await page.getByTestId('connection-person-b-select').selectOption({ label: nameB })
    await page.getByTestId('connection-kind-select').selectOption('friend')
    await page.getByTestId('add-connection-btn').click()

    const connectionItem = page
      .getByTestId('connection-list-item')
      .filter({ hasText: renamedA })
    await authExpect(connectionItem).toContainText('friend', { timeout: 20_000 })

    await connectionItem.getByTestId('edit-connection-btn').click()
    await page.getByTestId('connection-edit-person-b-select').selectOption({ label: nameC })
    await page.getByTestId('connection-edit-kind-select').selectOption('coworker')
    await fillStable(page.getByTestId('connection-edit-label-input'), 'promoted together', 15_000)
    await page.getByTestId('save-connection-btn').click()

    const updatedConnectionItem = page
      .getByTestId('connection-list-item')
      .filter({ hasText: renamedA })
    await authExpect(updatedConnectionItem).toContainText('coworker', { timeout: 20_000 })
    await authExpect(updatedConnectionItem).toContainText(nameC)
    await authExpect(updatedConnectionItem).toContainText('promoted together')

    // Clean up
    await updatedConnectionItem.getByTestId('delete-connection-btn').click()
    await authExpect(updatedConnectionItem).toHaveCount(0, { timeout: 20_000 })
    for (const name of [renamedA, nameB, nameC]) {
      const item = page.getByTestId('person-list-item').filter({ hasText: name })
      page.once('dialog', (dialog) => dialog.accept())
      await item.getByTestId('delete-person-btn').click()
      await authExpect(item).toHaveCount(0, { timeout: 20_000 })
    }
  })

  test('creates a group that connects every member to every other member', async ({ page }) => {
    const nameA = uniqueName('GroupA')
    const nameB = uniqueName('GroupB')
    const nameC = uniqueName('GroupC')

    await page.goto('/people')
    await ensureHydrated(page)

    for (const name of [nameA, nameB, nameC]) {
      await fillStable(page.getByTestId('person-name-input'), name, 15_000)
      await page.getByTestId('add-person-btn').click()
      await authExpect(page.getByTestId('person-list')).toContainText(name, { timeout: 20_000 })
    }

    const groupInput = page.getByTestId('group-people-input')
    for (const name of [nameA, nameB, nameC]) {
      await fillStable(groupInput, name, 15_000)
      const suggestion = page.getByTestId('group-people-suggestions').getByText(name, { exact: true })
      await authExpect(suggestion).toBeVisible({ timeout: 20_000 })
      await suggestion.click()
      await authExpect(
        page.getByTestId('group-person-chip').filter({ hasText: name }),
      ).toBeVisible()
    }

    await page.getByTestId('group-kind-select').selectOption('friend')
    await page.getByTestId('create-group-btn').click()
    await authExpect(page.getByText('Created 3 connections.')).toBeVisible({ timeout: 20_000 })

    for (const [a, b] of [
      [nameA, nameB],
      [nameA, nameC],
      [nameB, nameC],
    ]) {
      const item = page
        .getByTestId('connection-list-item')
        .filter({ hasText: a })
        .filter({ hasText: b })
      await authExpect(item).toContainText('friend', { timeout: 20_000 })
    }

    // Clean up
    for (const [a, b] of [
      [nameA, nameB],
      [nameA, nameC],
      [nameB, nameC],
    ]) {
      const item = page
        .getByTestId('connection-list-item')
        .filter({ hasText: a })
        .filter({ hasText: b })
      await item.getByTestId('delete-connection-btn').click()
      await authExpect(item).toHaveCount(0, { timeout: 20_000 })
    }
    for (const name of [nameA, nameB, nameC]) {
      const personItem = page.getByTestId('person-list-item').filter({ hasText: name })
      page.once('dialog', (dialog) => dialog.accept())
      await personItem.getByTestId('delete-person-btn').click()
      await authExpect(personItem).toHaveCount(0, { timeout: 20_000 })
    }
  })

  test('star mode connects one anchor to several others, keeps the selection after submit, and clears on demand', async ({
    page,
  }) => {
    const nameAnchor = uniqueName('StarAnchor')
    const nameB = uniqueName('StarB')
    const nameC = uniqueName('StarC')

    await page.goto('/people')
    await ensureHydrated(page)

    for (const name of [nameAnchor, nameB, nameC]) {
      await fillStable(page.getByTestId('person-name-input'), name, 15_000)
      await page.getByTestId('add-person-btn').click()
      await authExpect(page.getByTestId('person-list')).toContainText(name, { timeout: 20_000 })
    }

    await page.getByTestId('group-mode-star-btn').click()

    // Anchor is picked from a standalone select, independent of the members picker.
    await page.getByTestId('group-anchor-select').selectOption({ label: nameAnchor })

    const groupInput = page.getByTestId('group-people-input')
    for (const name of [nameB, nameC]) {
      await fillStable(groupInput, name, 15_000)
      const suggestion = page.getByTestId('group-people-suggestions').getByText(name, { exact: true })
      await authExpect(suggestion).toBeVisible({ timeout: 20_000 })
      await suggestion.click()
    }

    // The anchor is never offered as a member to pick.
    await fillStable(groupInput, nameAnchor, 15_000)
    await authExpect(page.getByTestId('group-people-suggestions')).toHaveCount(0)
    await groupInput.fill('')

    await page.getByTestId('group-kind-select').selectOption('coworker')
    await page.getByTestId('create-group-btn').click()
    await authExpect(page.getByText('Created 2 connections.')).toBeVisible({ timeout: 20_000 })

    for (const other of [nameB, nameC]) {
      const item = page
        .getByTestId('connection-list-item')
        .filter({ hasText: nameAnchor })
        .filter({ hasText: other })
      await authExpect(item).toContainText('coworker', { timeout: 20_000 })
    }

    // B and C should NOT be connected to each other.
    const bcItem = page
      .getByTestId('connection-list-item')
      .filter({ hasText: nameB })
      .filter({ hasText: nameC })
    await authExpect(bcItem).toHaveCount(0)

    // Anchor and members are preserved after submission, not reset.
    await authExpect(
      page.getByTestId('group-anchor-select').locator('option:checked'),
    ).toHaveText(nameAnchor)
    await authExpect(page.getByTestId('group-person-chip').filter({ hasText: nameB })).toBeVisible()
    await authExpect(page.getByTestId('group-person-chip').filter({ hasText: nameC })).toBeVisible()

    // Clear resets anchor, members, and comment.
    await page.getByTestId('group-clear-btn').click()
    await authExpect(page.getByTestId('group-anchor-select')).toHaveValue('')
    await authExpect(page.getByTestId('group-person-chip')).toHaveCount(0)

    // Clean up
    for (const other of [nameB, nameC]) {
      const item = page
        .getByTestId('connection-list-item')
        .filter({ hasText: nameAnchor })
        .filter({ hasText: other })
      await item.getByTestId('delete-connection-btn').click()
      await authExpect(item).toHaveCount(0, { timeout: 20_000 })
    }
    for (const name of [nameAnchor, nameB, nameC]) {
      const personItem = page.getByTestId('person-list-item').filter({ hasText: name })
      page.once('dialog', (dialog) => dialog.accept())
      await personItem.getByTestId('delete-person-btn').click()
      await authExpect(personItem).toHaveCount(0, { timeout: 20_000 })
    }
  })

  test('search panel finds cousins via the Cousins preset', async ({ page }) => {
    const nameMe = uniqueName('SearchMe')
    const nameParent = uniqueName('SearchParent')
    const nameAunt = uniqueName('SearchAunt')
    const nameCousin = uniqueName('SearchCousin')

    await page.goto('/people')
    await ensureHydrated(page)

    for (const name of [nameMe, nameParent, nameAunt, nameCousin]) {
      await fillStable(page.getByTestId('person-name-input'), name, 15_000)
      await page.getByTestId('add-person-btn').click()
      await authExpect(page.getByTestId('person-list')).toContainText(name, { timeout: 20_000 })
    }

    async function connect(a: string, b: string, kind: string) {
      await page.getByTestId('connection-person-a-select').selectOption({ label: a })
      await page.getByTestId('connection-person-b-select').selectOption({ label: b })
      await page.getByTestId('connection-kind-select').selectOption(kind)
      await page.getByTestId('add-connection-btn').click()
      const item = page.getByTestId('connection-list-item').filter({ hasText: a })
      await authExpect(item.filter({ hasText: b })).toBeVisible({ timeout: 20_000 })
    }

    // Parent is my parent, Aunt is Parent's sibling, Cousin is Aunt's child.
    await connect(nameParent, nameMe, 'parent_child')
    await connect(nameParent, nameAunt, 'sibling')
    await connect(nameAunt, nameCousin, 'parent_child')

    await page.getByTestId('search-start-select').selectOption({ label: nameMe })
    await page.getByTestId('search-preset-btn').filter({ hasText: 'Cousins' }).click()

    await authExpect(
      page.getByTestId('search-result-item').filter({ hasText: nameCousin }),
    ).toBeVisible({ timeout: 20_000 })
    // Parent and Aunt themselves shouldn't show up as cousins.
    await authExpect(
      page.getByTestId('search-result-item').filter({ hasText: nameParent }),
    ).toHaveCount(0)
    await authExpect(
      page.getByTestId('search-result-item').filter({ hasText: nameAunt }),
    ).toHaveCount(0)

    // Clean up
    for (const [a, b] of [
      [nameParent, nameMe],
      [nameParent, nameAunt],
      [nameAunt, nameCousin],
    ]) {
      const item = page
        .getByTestId('connection-list-item')
        .filter({ hasText: a })
        .filter({ hasText: b })
      await item.getByTestId('delete-connection-btn').click()
      await authExpect(item).toHaveCount(0, { timeout: 20_000 })
    }
    for (const name of [nameMe, nameParent, nameAunt, nameCousin]) {
      const personItem = page.getByTestId('person-list-item').filter({ hasText: name })
      page.once('dialog', (dialog) => dialog.accept())
      await personItem.getByTestId('delete-person-btn').click()
      await authExpect(personItem).toHaveCount(0, { timeout: 20_000 })
    }
  })

  test('suggests a sibling connection for two children of the same parent', async ({
    page,
  }) => {
    const nameParent = uniqueName('SuggestParent')
    const nameChildA = uniqueName('SuggestChildA')
    const nameChildB = uniqueName('SuggestChildB')

    await page.goto('/people')
    await ensureHydrated(page)

    for (const name of [nameParent, nameChildA, nameChildB]) {
      await fillStable(page.getByTestId('person-name-input'), name, 15_000)
      await page.getByTestId('add-person-btn').click()
      await authExpect(page.getByTestId('person-list')).toContainText(name, { timeout: 20_000 })
    }

    async function connect(a: string, b: string, kind: string) {
      await page.getByTestId('connection-person-a-select').selectOption({ label: a })
      await page.getByTestId('connection-person-b-select').selectOption({ label: b })
      await page.getByTestId('connection-kind-select').selectOption(kind)
      await page.getByTestId('add-connection-btn').click()
      const item = page.getByTestId('connection-list-item').filter({ hasText: a })
      await authExpect(item.filter({ hasText: b })).toBeVisible({ timeout: 20_000 })
    }

    await connect(nameParent, nameChildA, 'parent_child')
    await connect(nameParent, nameChildB, 'parent_child')

    const suggestionItem = page
      .getByTestId('suggestion-item')
      .filter({ hasText: nameChildA })
      .filter({ hasText: nameChildB })
    await authExpect(suggestionItem).toBeVisible({ timeout: 20_000 })
    await authExpect(suggestionItem).toContainText('sibling')
    await authExpect(suggestionItem).toContainText(nameParent)

    await page.getByTestId('suggestion-add-selected-btn').click()

    const siblingConnection = page
      .getByTestId('connection-list-item')
      .filter({ hasText: nameChildA })
      .filter({ hasText: nameChildB })
    await authExpect(siblingConnection).toContainText('sibling', { timeout: 20_000 })

    // Now that the sibling connection exists, the suggestion should be gone.
    await authExpect(
      page
        .getByTestId('suggestion-item')
        .filter({ hasText: nameChildA })
        .filter({ hasText: nameChildB }),
    ).toHaveCount(0)

    // Clean up
    for (const [a, b] of [
      [nameParent, nameChildA],
      [nameParent, nameChildB],
      [nameChildA, nameChildB],
    ]) {
      const item = page
        .getByTestId('connection-list-item')
        .filter({ hasText: a })
        .filter({ hasText: b })
      await item.getByTestId('delete-connection-btn').click()
      await authExpect(item).toHaveCount(0, { timeout: 20_000 })
    }
    for (const name of [nameParent, nameChildA, nameChildB]) {
      const personItem = page.getByTestId('person-list-item').filter({ hasText: name })
      page.once('dialog', (dialog) => dialog.accept())
      await personItem.getByTestId('delete-person-btn').click()
      await authExpect(personItem).toHaveCount(0, { timeout: 20_000 })
    }
  })
})
