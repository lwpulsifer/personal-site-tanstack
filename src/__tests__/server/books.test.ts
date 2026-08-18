import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'

// createServerFn mock: a transparent builder where handler() returns the raw
// function. This lets tests call server functions as plain async functions
// without the TanStack Start RPC layer.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder: {
      inputValidator: (s: unknown) => typeof builder
      handler: (fn: unknown) => unknown
    } = {
      inputValidator: () => builder,
      handler: (fn) => fn,
    }
    return builder
  },
}))

vi.mock('#/lib/supabase', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('#/server/auth.server', () => ({
  requireAuth: vi.fn(),
}))

// Import after mocks so the module picks up the mocked createServerFn
const { getBooks, upsertBook, setBookStatus, deleteBook } = await import('#/server/books')

/**
 * A fluent Supabase query-builder mock. Every method returns the chain, and
 * the chain is thenable so any step in the pipeline can be awaited.
 */
function makeChain(resolved: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'order', 'eq', 'single', 'insert', 'update', 'is', 'upsert', 'delete']) {
    chain[method] = vi.fn(() => chain)
  }
  // biome-ignore lint/suspicious/noThenProperty: needed for thenable mock in tests
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(resolved).then(resolve)
  return chain
}

function mockClient(
  ...chains: ReturnType<typeof makeChain>[]
): ReturnType<typeof getSupabaseServiceClient> {
  const from = vi.fn()
  for (const chain of chains) from.mockReturnValueOnce(chain)
  return { from } as unknown as ReturnType<typeof getSupabaseServiceClient>
}

const readingBook = {
  id: 'book-1',
  title: 'Reading Now',
  author: 'Author A',
  isbn: null,
  cover_url: null,
  status: 'READING',
  rating: null,
  review: null,
  started_at: '2026-06-01',
  finished_at: null,
  created_at: '2026-05-01T12:00:00Z',
  updated_at: '2026-06-01T12:00:00Z',
}

const readBook = {
  ...readingBook,
  id: 'book-2',
  title: 'Finished Book',
  status: 'READ',
  finished_at: '2026-07-01',
}

describe('getBooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sorts by finished_at, falling back to started_at then created_at', async () => {
    const wantToRead = {
      ...readingBook,
      id: 'book-3',
      title: 'Someday',
      status: 'WANT_TO_READ',
      started_at: null,
      created_at: '2026-08-01T12:00:00Z',
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(makeChain({ data: [readingBook, readBook, wantToRead], error: null })),
    )

    const result = await (getBooks as () => Promise<{ id: string }[]>)()

    expect(result.map((b) => b.id)).toEqual(['book-3', 'book-2', 'book-1'])
  })

  it('throws when the database returns an error', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(makeChain({ data: null, error: { message: 'DB error' } })),
    )

    await expect((getBooks as () => Promise<unknown>)()).rejects.toThrow('DB error')
  })
})

describe('upsertBook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when the caller is not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (upsertBook as (a: { data: { title: string; author: string; status: string } }) => Promise<unknown>)(
        { data: { title: 'X', author: 'Y', status: 'WANT_TO_READ' } },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('setBookStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when the caller is not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (setBookStatus as (a: { data: { bookId: string; status: 'READING' } }) => Promise<unknown>)(
        { data: { bookId: 'book-1', status: 'READING' } },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('sets started_at when transitioning to READING without one', async () => {
    vi.mocked(requireAuth).mockResolvedValue({} as never)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(
        makeChain({ data: { started_at: null }, error: null }),
        makeChain({ data: { ...readingBook, started_at: '2026-08-17' }, error: null }),
      ),
    )

    const result = await (
      setBookStatus as (a: { data: { bookId: string; status: 'READING' } }) => Promise<{ started_at: string }>
    )({ data: { bookId: 'book-1', status: 'READING' } })

    expect(result.started_at).toBeTruthy()
  })
})

describe('deleteBook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when the caller is not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (deleteBook as (a: { data: { bookId: string } }) => Promise<unknown>)({ data: { bookId: 'book-1' } }),
    ).rejects.toThrow('Unauthorized')
  })
})
