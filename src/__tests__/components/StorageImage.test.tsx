import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { StorageImage } = await import('#/components/maps/StorageImage')

describe('StorageImage', () => {
  it('builds a public URL from bucket and storagePath', () => {
    render(
      <StorageImage
        bucket="map-photos"
        storagePath="submissions/foo.jpg"
        alt="Test image"
        className="h-16 w-16 object-cover"
      />,
    )

    const img = screen.getByRole('img', { name: 'Test image' }) as HTMLImageElement
    expect(img.getAttribute('src')).toContain('map-photos/submissions/foo.jpg')
  })

  it('shows a loading state until the image loads', async () => {
    render(
      <StorageImage
        bucket="map-photos"
        storagePath="foo.jpg"
        alt="Test image"
        className="h-16 w-16 object-cover"
      />,
    )

    expect(screen.getByTestId('storage-image-loading')).toBeTruthy()

    const img = screen.getByRole('img', { name: 'Test image' })
    fireEvent.load(img)

    // Loading overlay disappears after onLoad
    expect(screen.queryByTestId('storage-image-loading')).toBeNull()
  })

  it('shows an error state when the image fails to load', async () => {
    render(
      <StorageImage
        bucket="map-photos"
        storagePath="missing.jpg"
        alt="Broken image"
        className="h-16 w-16 object-cover"
      />,
    )

    const img = screen.getByRole('img', { name: 'Broken image' })
    fireEvent.error(img)

    expect(await screen.findByTestId('storage-image-error')).toBeTruthy()
  })
})
