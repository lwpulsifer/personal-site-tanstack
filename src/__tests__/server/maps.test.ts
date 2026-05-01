import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { _resetRateLimitStore } from '#/server/rate-limit'

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

vi.mock('@tanstack/react-start/server', () => ({
  getRequestIP: vi.fn(() => '127.0.0.1'),
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

/**
 * A fluent Supabase query-builder mock. Every method returns the chain, and
 * the chain is thenable so any step in the pipeline can be awaited.
 */
function makeChain(resolved: Record<string, unknown>) {
  const chain: Record<string, unknown> = {}
  for (const method of [
    'select', 'order', 'eq', 'single', 'insert', 'update', 'is', 'upsert', 'delete', 'in', 'gte', 'lte',
  ]) {
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

  it('returns locations with photo counts, thumbnail paths, and submitter names', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ data: [sampleLocation], error: null }),
      makeChain({ data: [
        { location_id: 'loc-1', storage_path: 'lions/first.jpg', created_at: '2026-03-01T12:00:00Z' },
        { location_id: 'loc-1', storage_path: 'lions/second.jpg', created_at: '2026-03-02T12:00:00Z' },
      ], error: null }),
      makeChain({ data: [
        { location_id: 'loc-1', submitter_name: 'Jane' },
      ], error: null }),
    ))

    const result = await (getApprovedLocations as (a: { data: { mapSlug: string } }) => Promise<{ id: string; photo_count: number; thumbnail_path: string | null; submitted_by: string | null }[]>)(
      { data: { mapSlug: 'lions' } },
    )

    expect(result).toHaveLength(1)
    expect(result[0].photo_count).toBe(2)
    expect(result[0].thumbnail_path).toBe('lions/first.jpg')
    expect(result[0].submitted_by).toBe('Jane')
  })

  it('throws when the database returns an error', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
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
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ data: photos, error: null }),
    ))

    const result = await (getLocationPhotos as (a: { data: { locationId: string } }) => Promise<unknown[]>)(
      { data: { locationId: 'loc-1' } },
    )

    expect(result).toHaveLength(1)
  })
})

// Typed caller avoids repeated `as unknown as` casts in submitSighting tests
const callSubmitSighting = submitSighting as unknown as
  (a: { data: Record<string, unknown> }) => Promise<{ id: string }>

describe('submitSighting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetRateLimitStore()
  })

  it('creates a submission', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ count: 0, error: null }),
      makeChain({ data: { id: 'sub-new' }, error: null }),
    ))

    const result = await (submitSighting as unknown as (a: { data: Record<string, unknown> }) => Promise<{ id: string }>)(
      { data: { mapSlug: 'lions', proposedName: 'Test Lion', proposedLat: 37.78, proposedLng: -122.42, photos: [] } },
    )

    expect(result.id).toBe('sub-new')
  })

  it('inserts photo rows without a locationId', async () => {
    const photosChain = makeChain({ data: null, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ count: 0, error: null }),
      makeChain({ data: { id: 'sub-photos' }, error: null }),
      photosChain,
    ))

    const result = await (submitSighting as unknown as (a: { data: Record<string, unknown> }) => Promise<{ id: string }>)(
      { data: { mapSlug: 'lions', proposedName: 'Test', proposedLat: 37.78, proposedLng: -122.42, photos: [{ storagePath: 'img1.jpg' }, { storagePath: 'img2.jpg' }] } },
    )

    expect(result.id).toBe('sub-photos')
    expect(photosChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ location_id: null, submission_id: 'sub-photos', storage_path: 'img1.jpg', event_id: null }),
      expect.objectContaining({ location_id: null, submission_id: 'sub-photos', storage_path: 'img2.jpg', event_id: null }),
    ])
  })

  it('inserts photo rows with locationId when provided', async () => {
    const photosChain = makeChain({ data: null, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ count: 0, error: null }),
      makeChain({ data: { id: 'sub-with-loc' }, error: null }),
      photosChain,
    ))

    await (submitSighting as unknown as (a: { data: Record<string, unknown> }) => Promise<{ id: string }>)(
      { data: { mapSlug: 'lions', locationId: 'loc-1', photos: [{ storagePath: 'photo.jpg' }] } },
    )

    expect(photosChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ location_id: 'loc-1', submission_id: 'sub-with-loc', storage_path: 'photo.jpg' }),
    ])
  })

  it('throws when insert fails', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ count: 0, error: null }),
      makeChain({ data: null, error: { message: 'Insert failed' } }),
    ))

    await expect(
      (submitSighting as unknown as (a: { data: Record<string, unknown> }) => Promise<unknown>)(
        { data: { mapSlug: 'lions', proposedName: 'Test', proposedLat: 37.78, proposedLng: -122.42, photos: [] } },
      ),
    ).rejects.toThrow('Insert failed')
  })

  it('rejects new sightings without any coordinates', async () => {
    await expect(
      (submitSighting as unknown as (a: { data: Record<string, unknown> }) => Promise<unknown>)({
        data: {
          mapSlug: 'lions',
          proposedName: 'No-coords Lion',
          photos: [],
        },
      }),
    ).rejects.toThrow('location')
  })

  it('rejects new sightings where only photos lack EXIF GPS', async () => {
    await expect(
      (submitSighting as unknown as (a: { data: Record<string, unknown> }) => Promise<unknown>)({
        data: {
          mapSlug: 'lions',
          proposedName: 'No-coords Lion',
          photos: [{ storagePath: 'img.jpg' }],
        },
      }),
    ).rejects.toThrow('location')
  })

  it('rejects out-of-bounds coordinates for new sightings', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ count: 0, error: null }),
    ))

    await expect(
      (submitSighting as unknown as (a: { data: Record<string, unknown> }) => Promise<unknown>)({
        data: {
          mapSlug: 'lions',
          proposedLat: 34.05,
          proposedLng: -118.25,
          photos: [],
        },
      }),
    ).rejects.toThrow('Please submit sightings within the San Francisco Bay Area.')
  })

  it('rejects when global pending limit is reached', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ count: 100, error: null }),
    ))

    await expect(
      callSubmitSighting({ data: { mapSlug: 'lions', proposedName: 'Test', proposedLat: 37.78, proposedLng: -122.42, photos: [] } }),
    ).rejects.toThrow('Too many pending submissions. Please try again later.')
  })

  it('rejects the 6th submission from the same IP within a minute', async () => {
    const makeSuccessClient = () => mockClient(
      makeChain({ count: 0, error: null }),
      makeChain({ data: { id: `sub-${Math.random()}` }, error: null }),
    )
    const payload = { data: { mapSlug: 'lions', proposedName: 'Test', proposedLat: 37.78, proposedLng: -122.42, photos: [] } }

    // First 5 succeed
    for (let i = 0; i < 5; i++) {
      vi.mocked(getSupabaseServiceClient).mockReturnValue(makeSuccessClient())
      await callSubmitSighting(payload)
    }

    // 6th is rate-limited
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      makeChain({ count: 0, error: null }),
    ))
    await expect(callSubmitSighting(payload)).rejects.toThrow(
      'You are submitting too quickly. Please wait a moment.',
    )
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

  it('creates a new location and links photos when no location_id', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' } as never)

    const submission = {
      id: 'sub-1',
      map_slug: 'lions',
      location_id: null,
      proposed_name: 'New Lion',
      proposed_lat: 37.78,
      proposed_lng: -122.42,
      proposed_address: '123 Test St',
      occurred_at: null,
      time_zone: null,
      notes: null,
      submitter_name: null,
      submitter_email: null,
      created_at: '2026-03-15T12:00:00Z',
    }

    const fetchChain = makeChain({ data: submission, error: null })
    const findExistingChain = makeChain({ data: [], error: null })
    const insertLocationChain = makeChain({ data: { id: 'new-loc-1' }, error: null })
    const insertEventChain = makeChain({ data: { id: 'event-1' }, error: null })
    const updatePhotosChain = makeChain({ data: null, error: null })
    const updateSubmissionChain = makeChain({ data: null, error: null })

    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      fetchChain,
      findExistingChain,
      insertLocationChain,
      insertEventChain,
      updatePhotosChain,
      updateSubmissionChain,
    ))

    const result = await (approveSubmission as (a: { data: { submissionId: string } }) => Promise<{ ok: boolean; locationId: string; eventId: string }>)(
      { data: { submissionId: 'sub-1' } },
    )

    expect(result.ok).toBe(true)
    expect(result.locationId).toBe('new-loc-1')
    expect(result.eventId).toBe('event-1')
    // Should have created a location with the proposed fields
    expect(insertLocationChain.insert).toHaveBeenCalledWith({
      map_slug: 'lions',
      name: 'New Lion',
      lat: 37.78,
      lng: -122.42,
      address: '123 Test St',
      created_by: 'admin-1',
    })
    expect(insertEventChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      map_slug: 'lions',
      location_id: 'new-loc-1',
      created_by: 'admin-1',
    }))
  })

  it('uses existing location_id when present', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' } as never)

    const submission = {
      id: 'sub-2',
      map_slug: 'lions',
      location_id: 'existing-loc',
      proposed_name: null,
      proposed_lat: null,
      proposed_lng: null,
      proposed_address: null,
      occurred_at: null,
      time_zone: null,
      notes: null,
      submitter_name: null,
      submitter_email: null,
      created_at: '2026-03-15T12:00:00Z',
    }

    const fetchChain = makeChain({ data: submission, error: null })
    const insertEventChain = makeChain({ data: { id: 'event-2' }, error: null })
    const updatePhotosChain = makeChain({ data: null, error: null })
    const updateSubmissionChain = makeChain({ data: null, error: null })

    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient(
      fetchChain,
      insertEventChain,
      updatePhotosChain,
      updateSubmissionChain,
    ))

    const result = await (approveSubmission as (a: { data: { submissionId: string } }) => Promise<{ ok: boolean; locationId: string; eventId: string }>)(
      { data: { submissionId: 'sub-2' } },
    )

    expect(result.ok).toBe(true)
    expect(result.locationId).toBe('existing-loc')
    expect(result.eventId).toBe('event-2')
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
