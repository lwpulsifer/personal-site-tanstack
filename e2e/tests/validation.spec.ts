import { expect, test } from '@playwright/test'

// Server-function arguments are client-controlled JSON, so TypeScript's types
// don't protect the server at runtime. These tests send deliberately malformed
// arguments straight at the real server-function handlers (bypassing the typed
// client wrappers) and expect an `Invalid input` validation error — raised *before* auth or
// the database are touched. Dev-server only: they read ids from Vite's
// transformed modules.

type Call = [file: string, fn: string, args: unknown[]]

async function callServerFn(page: import('@playwright/test').Page, [file, fn, args]: Call) {
  return page.evaluate(
    async ([file, fn, args]) => {
      const src = await (await fetch(`/src/server/${file}.ts`)).text()
      const id = src.match(new RegExp(`createServerReference_\\d+\\("(${fn}-[^"]+)"`))?.[1]
      const dep = src.match(/from "([^"]*server-functions[^"]*)"/)?.[1]
      if (!id || !dep) return { error: `could not find server reference for ${fn}` }
      const { createServerReference } = await import(/* @vite-ignore */ dep)
      try {
        await createServerReference(id, fn)(...(args as unknown[]))
        return { ok: true }
      } catch (e) {
        return { error: String((e as Error)?.message ?? e) }
      }
    },
    [file, fn, args] as const,
  )
}

// server/validate.ts turns zod failures into a plain `Invalid input: …` error.
const ZOD = /Invalid input/

const cases: { name: string; call: Call }[] = [
  { name: 'getPublishedPost non-string slug', call: ['posts', 'getPublishedPost', [123]] },
  { name: 'getBook non-string id', call: ['books', 'getBook', [123]] },
  { name: 'getPageViews non-string url', call: ['pageViews', 'getPageViews', [123]] },
  { name: 'logPageView non-string url (public endpoint)', call: ['pageViews', 'logPageView', [{ x: 1 }]] },
  { name: 'deleteBook non-string id', call: ['books', 'deleteBook', [123]] },
  { name: 'setBookStatus bad status', call: ['books', 'setBookStatus', ['id', 'NOPE']] },
  { name: 'setPostStatus non-string id', call: ['posts', 'setPostStatus', [123, 'PUBLISHED']] },
  { name: 'deletePerson non-string id', call: ['people', 'deletePerson', [123]] },
  { name: 'updatePerson non-string id', call: ['people', 'updatePerson', [123, 'name']] },
  { name: 'insertPerson empty name', call: ['people', 'insertPerson', ['']] },
  { name: 'deleteConnection non-string id', call: ['people', 'deleteConnection', [123]] },
  { name: 'searchPeople limit above 200', call: ['people', 'searchPeople', ['', 201, 0]] },
  { name: 'searchPeople limit below 1', call: ['people', 'searchPeople', ['', 0, 0]] },
  { name: 'searchPeople negative offset', call: ['people', 'searchPeople', ['', 100, -1]] },
  { name: 'searchPeople non-integer limit', call: ['people', 'searchPeople', ['', 1.5, 0]] },
  { name: 'exchangeCode non-string code', call: ['spotify', 'exchangeCode', [123]] },
  { name: 'upsertPost wrong field types', call: ['posts', 'upsertPost', [{ slug: 1 }]] },
  {
    name: 'insertConnection self-connection',
    call: ['people', 'insertConnection', [{ personAId: 'a', personBId: 'a', kind: 'friend' }]],
  },
]

// Reads server-function ids from Vite's transformed modules, so it only works
// against the dev server (the production build serves no source modules).
test.skip(!!process.env.CI || process.env.E2E_TARGET === 'react', 'Solid dev server only')

test.describe('server function input validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('body[data-hydrated="true"]', { timeout: 30_000 })
  })

  for (const { name, call } of cases) {
    test(`rejects: ${name}`, async ({ page }) => {
      const result = await callServerFn(page, call)
      expect(result.error, 'expected the call to be rejected').toBeDefined()
      expect(result.error).toMatch(ZOD)
      // Validation must run before auth, so the failure is not "Unauthorized".
      expect(result.error).not.toMatch(/unauthorized/i)
    })
  }

  test('accepts well-formed arguments (control: the harness is not over-rejecting)', async ({ page }) => {
    const result = await callServerFn(page, ['pageViews', 'getPageViews', ['blog']])
    // Whatever happens downstream (DB env may be absent), it must not be a validation error.
    expect(result.error ?? '').not.toMatch(ZOD)
  })
})
