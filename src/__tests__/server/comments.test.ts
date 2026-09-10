import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { getAuthUser, requireAuth } from '#/server/auth.server'
import { _resetRateLimitStore } from '#/server/rate-limit'

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
  getAuthUser: vi.fn(),
}))

const cookies: Record<string, string> = {}
const getCookie = vi.fn((name: string) => cookies[name])
const setCookie = vi.fn((name: string, value: string, _options?: unknown) => {
  cookies[name] = value
})
const getRequestIP = vi.fn(() => '127.0.0.1')

vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (name: string) => getCookie(name),
  setCookie: (name: string, value: string, options?: unknown) =>
    setCookie(name, value, options),
  getRequestIP: () => getRequestIP(),
}))

const { getBookComments, addComment, getPendingComments, approveComment, rejectComment } =
  await import('#/server/comments')

function makeChain(resolved: Record<string, unknown>) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'order', 'eq', 'single', 'insert', 'update', 'delete']) {
    chain[method] = vi.fn(() => chain)
  }
  // biome-ignore lint/suspicious/noThenProperty: needed for thenable mock in tests
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(resolved).then(resolve)
  return chain
}

function mockClient(...chains: ReturnType<typeof makeChain>[]) {
  const from = vi.fn()
  for (const chain of chains) from.mockReturnValueOnce(chain)
  return { from } as unknown as ReturnType<typeof getSupabaseServiceClient>
}

const sampleComment = {
  id: 'c-1',
  book_id: 'book-1',
  author_name: 'Jane',
  body: 'Great book!',
  status: 'pending' as const,
  commenter_token: 'token-abc',
  created_at: '2026-09-10T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
}

describe('getBookComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(cookies)) delete cookies[key]
    vi.mocked(getAuthUser).mockResolvedValue(null)
  })

  it('shows approved comments to anyone', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(
        makeChain({
          data: [{ ...sampleComment, status: 'approved' }],
          error: null,
        }),
      ),
    )

    const result = await (
      getBookComments as (a: { data: { bookId: string } }) => Promise<
        { id: string; isOwn: boolean; commenter_token?: string }[]
      >
    )({ data: { bookId: 'book-1' } })

    expect(result).toHaveLength(1)
    expect(result[0].commenter_token).toBeUndefined()
  })

  it('hides pending comments from an anonymous visitor with no matching token', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(makeChain({ data: [sampleComment], error: null })),
    )

    const result = await (
      getBookComments as (a: { data: { bookId: string } }) => Promise<unknown[]>
    )({ data: { bookId: 'book-1' } })

    expect(result).toHaveLength(0)
  })

  it('shows a visitor their own pending comment via the commenter cookie', async () => {
    cookies.book_commenter = 'token-abc'
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(makeChain({ data: [sampleComment], error: null })),
    )

    const result = await (
      getBookComments as (a: { data: { bookId: string } }) => Promise<
        { isOwn: boolean }[]
      >
    )({ data: { bookId: 'book-1' } })

    expect(result).toHaveLength(1)
    expect(result[0].isOwn).toBe(true)
  })

  it('shows all pending comments to the admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'admin-1' } as never)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(makeChain({ data: [sampleComment], error: null })),
    )

    const result = await (
      getBookComments as (a: { data: { bookId: string } }) => Promise<
        { isOwn: boolean }[]
      >
    )({ data: { bookId: 'book-1' } })

    expect(result).toHaveLength(1)
    expect(result[0].isOwn).toBe(false)
  })
})

describe('addComment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetRateLimitStore()
    for (const key of Object.keys(cookies)) delete cookies[key]
  })

  it('silently drops submissions that fill the honeypot field', async () => {
    const client = mockClient()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(client)

    const result = await (
      addComment as unknown as (a: {
        data: Record<string, unknown>
      }) => Promise<{ isOwn: boolean }>
    )({
      data: {
        bookId: 'book-1',
        authorName: 'Bot',
        body: 'spam',
        website: 'http://spam.example',
      },
    })

    expect(result.isOwn).toBe(true)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('creates a pending comment and sets the commenter cookie', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(makeChain({ data: sampleComment, error: null })),
    )

    const result = await (
      addComment as unknown as (a: {
        data: Record<string, unknown>
      }) => Promise<{ isOwn: boolean; status: string }>
    )({ data: { bookId: 'book-1', authorName: 'Jane', body: 'Great book!' } })

    expect(result.status).toBe('pending')
    expect(result.isOwn).toBe(true)
    expect(setCookie).toHaveBeenCalledWith(
      'book_commenter',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    )
  })

  it('rate limits repeated submissions from the same IP', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(
        ...Array.from({ length: 6 }, () =>
          makeChain({ data: sampleComment, error: null }),
        ),
      ),
    )

    const call = () =>
      (
        addComment as unknown as (a: {
          data: Record<string, unknown>
        }) => Promise<unknown>
      )({ data: { bookId: 'book-1', authorName: 'Jane', body: 'hi' } })

    for (let i = 0; i < 5; i++) await call()
    await expect(call()).rejects.toThrow('too quickly')
  })
})

describe('getPendingComments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))
    await expect(
      (getPendingComments as () => Promise<unknown>)(),
    ).rejects.toThrow('Unauthorized')
  })

  it('returns pending comments with the book title', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'admin-1' } as never)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      mockClient(
        makeChain({
          data: [{ ...sampleComment, books: { id: 'book-1', title: 'Dune' } }],
          error: null,
        }),
      ),
    )

    const result = await (
      getPendingComments as () => Promise<{ book: { title: string } }[]>
    )()

    expect(result[0].book.title).toBe('Dune')
  })
})

describe('approveComment / rejectComment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approveComment requires auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))
    await expect(
      (
        approveComment as (a: { data: { commentId: string } }) => Promise<unknown>
      )({ data: { commentId: 'c-1' } }),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejectComment deletes the row', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'admin-1' } as never)
    const chain = makeChain({ error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(chain))

    const result = await (
      rejectComment as (a: { data: { commentId: string } }) => Promise<{
        ok: boolean
      }>
    )({ data: { commentId: 'c-1' } })

    expect(result.ok).toBe(true)
    expect(chain.delete).toHaveBeenCalled()
  })
})
