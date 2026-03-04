import { test as base, expect } from '@playwright/test'

// Extends the base `page` fixture to load the saved admin session,
// so every test that imports from here is automatically authenticated.
export const test = base.extend({
  page: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect }
