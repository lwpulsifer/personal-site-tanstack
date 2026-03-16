import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('#/server/maps', () => ({
  submitSighting: vi.fn(),
  getApprovedLocations: vi.fn(),
  getLocationPhotos: vi.fn(),
  getPendingSubmissions: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  deleteLocation: vi.fn(),
}))

vi.mock('#/lib/exif', () => ({
  extractExifFromImage: vi.fn().mockResolvedValue({ coords: null, takenAtLocal: null }),
}))

vi.mock('#/lib/supabase', () => ({
  getSupabaseBrowserClient: vi.fn().mockReturnValue({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}))

const { SubmissionForm } = await import('#/components/maps/SubmissionForm')

function renderWithProvider(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe('SubmissionForm', () => {
  it('renders the form with all fields', () => {
    renderWithProvider(<SubmissionForm mapSlug="lions" onClose={() => {}} />)

    expect(screen.getByText('Report a Lion Sighting')).toBeTruthy()
    expect(screen.getByLabelText(/name.*description/i)).toBeTruthy()
    expect(screen.getByLabelText(/address/i)).toBeTruthy()
    expect(screen.getByLabelText(/latitude/i)).toBeTruthy()
    expect(screen.getByLabelText(/longitude/i)).toBeTruthy()
    expect(screen.getByLabelText(/photos/i)).toBeTruthy()
    expect(screen.getByLabelText(/notes/i)).toBeTruthy()
    expect(screen.getByText('Submit Sighting')).toBeTruthy()
  })

  it('pre-fills lat/lng when provided', () => {
    renderWithProvider(
      <SubmissionForm mapSlug="lions" onClose={() => {}} initialLat={37.78} initialLng={-122.42} />,
    )

    const latInput = screen.getByLabelText(/latitude/i) as HTMLInputElement
    const lngInput = screen.getByLabelText(/longitude/i) as HTMLInputElement

    expect(latInput.value).toBe('37.78')
    expect(lngInput.value).toBe('-122.42')
  })

  it('renders add-photos mode without location fields', () => {
    renderWithProvider(
      <SubmissionForm
        mapSlug="lions"
        mode="add-photos"
        locationId="loc-1"
        initialName="City Hall Lions"
        onClose={() => {}}
      />,
    )

    expect(screen.getByTestId('submission-form-heading').textContent).toBe('Add Photos')
    expect(screen.getByTestId('add-photos-hint')).toBeTruthy()

    // Location fields should be hidden in add-photos mode.
    expect(screen.queryByTestId('field-name')).toBeNull()
    expect(screen.queryByTestId('field-address')).toBeNull()
    expect(screen.queryByTestId('field-lat')).toBeNull()
    expect(screen.queryByTestId('field-lng')).toBeNull()

    // Photos input remains.
    expect(screen.getByTestId('field-photos')).toBeTruthy()
  })
})
