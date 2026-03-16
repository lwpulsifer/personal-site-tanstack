import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockPhotos = [
  { id: 'p1', storage_path: 'submissions/one.jpg', caption: 'First' },
  { id: 'p2', storage_path: 'submissions/two.jpg', caption: 'Second' },
]

vi.mock('#/lib/queries', () => ({
  mapPhotosQueryOptions: (locationId: string) => ({
    queryKey: ['mapPhotos', locationId],
    queryFn: () => Promise.resolve(mockPhotos),
  }),
}))

const { PhotoGallery } = await import('#/components/maps/PhotoGallery')

function renderWithProvider(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('PhotoGallery', () => {
  it('opens a modal carousel when a photo is clicked and can navigate', async () => {
    renderWithProvider(<PhotoGallery locationId="loc-1" />)

    const thumb0 = await screen.findByTestId('location-photo-0')
    await userEvent.click(thumb0)

    const modal = await screen.findByTestId('photo-carousel-modal')
    expect(within(modal).getByRole('img', { name: 'First' })).toBeTruthy()

    await userEvent.click(within(modal).getByTestId('carousel-next'))
    expect(within(modal).getByRole('img', { name: 'Second' })).toBeTruthy()

    await userEvent.click(within(modal).getByTestId('carousel-prev'))
    expect(within(modal).getByRole('img', { name: 'First' })).toBeTruthy()

    await userEvent.click(within(modal).getByTestId('carousel-close'))
    expect(screen.queryByTestId('photo-carousel-modal')).toBeNull()
  })
})

