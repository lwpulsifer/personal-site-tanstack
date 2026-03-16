import { describe, expect, it, vi } from 'vitest'

vi.mock('exifreader', () => ({
  default: {
    load: vi.fn(),
  },
}))

const ExifReader = (await import('exifreader')).default

const { extractGpsFromImage } = await import('#/lib/exif')

function makeFile(content = 'fake'): File {
  return new File([content], 'test.jpg', { type: 'image/jpeg' })
}

describe('extractGpsFromImage', () => {
  it('returns coordinates when EXIF GPS data is present', async () => {
    vi.mocked(ExifReader.load).mockReturnValue({
      gps: { Latitude: 37.7749, Longitude: -122.4194 },
    } as never)

    const result = await extractGpsFromImage(makeFile())

    expect(result).toEqual({ lat: 37.7749, lng: -122.4194 })
  })

  it('returns null when no GPS data is present', async () => {
    vi.mocked(ExifReader.load).mockReturnValue({} as never)

    const result = await extractGpsFromImage(makeFile())

    expect(result).toBeNull()
  })

  it('returns null when EXIF parsing throws', async () => {
    vi.mocked(ExifReader.load).mockImplementation(() => {
      throw new Error('Invalid EXIF')
    })

    const result = await extractGpsFromImage(makeFile())

    expect(result).toBeNull()
  })

  it('returns null when GPS values are not numbers', async () => {
    vi.mocked(ExifReader.load).mockReturnValue({
      gps: { Latitude: undefined, Longitude: undefined },
    } as never)

    const result = await extractGpsFromImage(makeFile())

    expect(result).toBeNull()
  })
})
