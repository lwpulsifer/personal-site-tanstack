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
  submitLionSighting,
  getPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  deleteLocation,
} = await import('#/server/lions')

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
  name: 'Palace of Fine Arts Lion',
  description: 'Golden lion statue',
  address: '3301 Lyon St',
  lat: 37.8029,
  lng: -122.4484,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  created_by: null,
}

const sampleSubmission = {
  id: 'sub-1',
  location_id: null,
  proposed_name: 'New Lion',
  proposed_lat: 37.78,
  proposed_lng: -122.42,
  proposed_address: '123 Main St',
  notes: 'Big lion',
  submitter_name: 'Test User',
  submitter_email: 'test@example.com',
  status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
  created_at: '2026-03-10T00:00:00Z',
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

    const result = await (getApprovedLocations as () => Promise<{ id: string; photo_count: number }[]>)()

    expect(result).toHaveLength(1)
    expect(result[0].photo_count).toBe(2)
  })

  it('throws when the database returns an error', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: null, error: { message: 'DB error' } }),
    ))

    await expect((getApprovedLocations as () => Promise<unknown>)()).rejects.toThrow('DB error')
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

describe('submitLionSighting', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a submission', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: { id: 'sub-new' }, error: null }),
    ))

    const result = await (submitLionSighting as (a: { data: Record<string, unknown> }) => Promise<{ id: string }>)(
      { data: { proposedName: 'Test Lion', proposedLat: 37.78, proposedLng: -122.42, photoStoragePaths: [] } },
    )

    expect(result.id).toBe('sub-new')
  })

  it('throws when insert fails', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: null, error: { message: 'Insert failed' } }),
    ))

    await expect(
      (submitLionSighting as (a: { data: Record<string, unknown> }) => Promise<unknown>)(
        { data: { proposedName: 'Test', photoStoragePaths: [] } },
      ),
    ).rejects.toThrow('Insert failed')
  })
})

describe('getPendingSubmissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect((getPendingSubmissions as () => Promise<unknown>)()).rejects.toThrow('Unauthorized')
  })

  it('returns pending submissions with photos', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient(
      makeChain({ data: [sampleSubmission], error: null }),
      makeChain({ data: [], error: null }),
    ))

    const result = await (getPendingSubmissions as () => Promise<{ id: string; photos: unknown[] }[]>)()

    expect(result).toHaveLength(1)
    expect(result[0].photos).toEqual([])
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
