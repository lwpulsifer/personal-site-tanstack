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
const { getPublishedPosts, getPublishedPost, getAllTags, getAdminPosts, setPostStatus } =
  await import('#/server/posts')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const publishedPost = {
  id: 'post-1',
  slug: 'hello',
  title: 'Hello',
  description: null,
  content: '# Hello',
  tags: ['typescript', 'react'],
  hero_image: null,
  // Use midday UTC to avoid local-timezone day-boundary shifts in assertions.
  published_at: '2025-06-15T12:00:00Z',
  created_at: '2025-06-15T12:00:00Z',
  updated_at: '2025-06-15T12:00:00Z',
  author_id: null,
}

const pendingPost = { ...publishedPost, id: 'post-2', slug: 'draft', title: 'Draft' }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getPublishedPosts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns only posts that have PUBLISHED status', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ data: [publishedPost, pendingPost], error: null }),
      makeChain({ data: [{ post_id: 'post-1' }], error: null }),
    ))

    const result = await (getPublishedPosts as () => Promise<{ slug: string }[]>)()

    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('hello')
  })

  it('throws when the database returns an error', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ data: null, error: { message: 'DB error' } }),
      makeChain({ data: [], error: null }),
    ))

    await expect((getPublishedPosts as () => Promise<unknown>)()).rejects.toThrow('DB error')
  })
})

describe('getPublishedPost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when the post does not exist', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ data: null, error: { message: 'not found' } }),
    ))

    const result = await (getPublishedPost as (a: { data: { slug: string } }) => Promise<unknown>)(
      { data: { slug: 'missing' } },
    )

    expect(result).toBeNull()
  })

  it('returns null when the post exists but is not published', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ data: publishedPost, error: null }),
      makeChain({ data: { status: 'PENDING' }, error: null }),
    ))

    const result = await (getPublishedPost as (a: { data: { slug: string } }) => Promise<unknown>)(
      { data: { slug: 'hello' } },
    )

    expect(result).toBeNull()
  })

  it('returns the post when it exists and is published', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ data: publishedPost, error: null }),
      makeChain({ data: { status: 'PUBLISHED' }, error: null }),
    ))

    const result = await (getPublishedPost as (a: { data: { slug: string } }) => Promise<{ slug: string }>)(
      { data: { slug: 'hello' } },
    )

    expect(result?.slug).toBe('hello')
  })
})

describe('getAllTags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a sorted, deduplicated list of tags across all posts', async () => {
    const chain = makeChain({ data: null, error: null })
    chain.select = vi.fn().mockResolvedValue({
      data: [{ tags: ['react', 'typescript'] }, { tags: ['typescript', 'css'] }],
      error: null,
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(chain))

    const result = await (getAllTags as () => Promise<string[]>)()

    expect(result).toEqual(['css', 'react', 'typescript'])
  })
})

describe('getAdminPosts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when the caller is not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect((getAdminPosts as () => Promise<unknown>)()).rejects.toThrow('Unauthorized')
  })
})

describe('setPostStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when the caller is not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (setPostStatus as (a: { data: { postId: string; status: 'PENDING' } }) => Promise<unknown>)(
        { data: { postId: 'post-1', status: 'PENDING' } },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})
