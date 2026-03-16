import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'

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
  getSupabaseClient: vi.fn(),
}))

vi.mock('#/server/auth.server', () => ({
  requireAuth: vi.fn(),
}))

const {
  getApprovedLocations,
  getLocationPhotos,
  submitSighting,
  getPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  deleteLocation,
} = await import('#/server/maps')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain(resolved: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const method of [
    'select', 'order', 'eq', 'single', 'insert', 'update', 'is', 'upsert', 'delete', 'in',
  ]) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => void) => Promise.resolve(resolved).then(resolve)
  return chain
}

function mockClient(
  ...chains: ReturnType<typeof makeChain>[]
): ReturnType<typeof getSupabaseClient> {
  const from = vi.fn()
  for (const chain of chains) from.mockReturnValueOnce(chain)
  return { from } as unknown as ReturnType<typeof getSupabaseClient>
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleLocation = {
  id: 'loc-1',
  map_slug: 'lions',
  name: 'Palace of Fine Arts Lion',
  description: 'Golden lion statue',
  address: '3301 Lyon St',
  lat: 37.8029,
  lng: -122.4484,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  created_by: null,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getApprovedLocations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns locations with photo counts', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: [sampleLocation], error: null }),
      makeChain({ data: [{ location_id: 'loc-1' }, { location_id: 'loc-1' }], error: null }),
    ))

    const result = await (getApprovedLocations as (a: { data: { mapSlug: string } }) => Promise<{ id: string; photo_count: number }[]>)(
      { data: { mapSlug: 'lions' } },
    )

    expect(result).toHaveLength(1)
    expect(result[0].photo_count).toBe(2)
  })

  it('throws when the database returns an error', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: null, error: { message: 'DB error' } }),
    ))

    await expect(
      (getApprovedLocations as (a: { data: { mapSlug: string } }) => Promise<unknown>)(
        { data: { mapSlug: 'lions' } },
      ),
    ).rejects.toThrow('DB error')
  })
})

describe('getLocationPhotos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns photos for a location', async () => {
    const photos = [{ id: 'photo-1', location_id: 'loc-1', storage_path: 'test.jpg' }]
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: photos, error: null }),
    ))

    const result = await (getLocationPhotos as (a: { data: { locationId: string } }) => Promise<unknown[]>)(
      { data: { locationId: 'loc-1' } },
    )

    expect(result).toHaveLength(1)
  })
})

describe('submitSighting', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a submission', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: { id: 'sub-new' }, error: null }),
    ))

    const result = await (submitSighting as (a: { data: Record<string, unknown> }) => Promise<{ id: string }>)(
      { data: { mapSlug: 'lions', proposedName: 'Test Lion', proposedLat: 37.78, proposedLng: -122.42, photoStoragePaths: [] } },
    )

    expect(result.id).toBe('sub-new')
  })

  it('throws when insert fails', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: null, error: { message: 'Insert failed' } }),
    ))

    await expect(
      (submitSighting as (a: { data: Record<string, unknown> }) => Promise<unknown>)(
        { data: { mapSlug: 'lions', proposedName: 'Test', photoStoragePaths: [] } },
      ),
    ).rejects.toThrow('Insert failed')
  })
})

describe('getPendingSubmissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (getPendingSubmissions as (a: { data: { mapSlug?: string } }) => Promise<unknown>)(
        { data: {} },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('approveSubmission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (approveSubmission as (a: { data: { submissionId: string } }) => Promise<unknown>)(
        { data: { submissionId: 'sub-1' } },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('rejectSubmission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (rejectSubmission as (a: { data: { submissionId: string } }) => Promise<unknown>)(
        { data: { submissionId: 'sub-1' } },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('deleteLocation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (deleteLocation as (a: { data: { id: string } }) => Promise<unknown>)(
        { data: { id: 'loc-1' } },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})
