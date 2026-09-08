import { expect, type Locator, type Page } from '@playwright/test'

export async function ensureHydrated(page: Page, timeoutMs = 20_000) {
  await page.waitForSelector('body[data-hydrated="true"]', { timeout: timeoutMs })
}

export async function fillStable(locator: Locator, value: string, timeoutMs = 10_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await locator.fill(value)
    // Give hydration a moment; controlled inputs can be overwritten if React isn't ready yet.
    await locator.page().waitForTimeout(100)
    const current = await locator.inputValue().catch(() => '')
    if (current === value) return
  }
  throw new Error('Timed out waiting for input value to stick (hydration?)')
}

// Picks a person from one of the PersonCombobox pickers in the connections
// pane: types the name into the combobox input and clicks the matching
// suggestion, rather than using selectOption() as for a native <select>.
export async function pickPerson(page: Page, testId: string, name: string) {
  await fillStable(page.getByTestId(testId), name, 15_000)
  const option = page.getByTestId(`${testId}-listbox`).getByText(name, { exact: true })
  await option.click()
}

export async function clickUntilVisible(
  clickTarget: Locator,
  expectedVisible: Locator,
  timeoutMs = 10_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await clickTarget.click()
    if (await expectedVisible.isVisible().catch(() => false)) return
    await clickTarget.page().waitForTimeout(100)
  }
  // This produces a better error message than a generic timeout loop.
  await expect(expectedVisible).toBeVisible({ timeout: 1000 })
}

