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
// pane: types the full name into the combobox input, which auto-highlights
// the top match, then presses Enter to commit it — rather than using
// selectOption() as for a native <select>.
export async function pickPerson(page: Page, testId: string, name: string) {
  const input = page.getByTestId(testId)
  await fillStable(input, name, 15_000)
  await input.press('Enter')
}

// Clicks `clickTarget` until `expectedVisible` shows up, tolerating clicks that
// land before hydration. Frameworks apply the resulting UI update at different
// times (React flushes click handlers synchronously; Solid batches to the next
// microtask/frame), so after each click we give the update a short window to
// land instead of re-clicking immediately — a second click can otherwise hit a
// target that the first click already replaced.
export async function clickUntilVisible(
  clickTarget: Locator,
  expectedVisible: Locator,
  timeoutMs = 10_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await expectedVisible.isVisible().catch(() => false)) return
    // The target may have vanished because the UI already updated; that's fine.
    await clickTarget.click({ timeout: 2_000 }).catch(() => {})
    try {
      await expectedVisible.waitFor({ state: 'visible', timeout: 500 })
      return
    } catch {
      // Not there yet (e.g. clicked before hydration) — loop and click again.
    }
  }
  // This produces a better error message than a generic timeout loop.
  await expect(expectedVisible).toBeVisible({ timeout: 1000 })
}
