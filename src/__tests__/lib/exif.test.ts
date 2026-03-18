import { describe, expect, it, vi } from 'vitest'

vi.mock('exifreader', () => ({
  default: {
    load: vi.fn(),
  },
}))

const ExifReader = (await import('exifreader')).default

const { extractExifFromImage } = await import('#/lib/exif')

function makeFile(content = 'fake'): File {
  return new File([content], 'test.jpg', { type: 'image/jpeg' })
}

describe('extractExifFromImage', () => {
  it('returns coordinates when EXIF GPS data is present', async () => {
    vi.mocked(ExifReader.load).mockReturnValue({
      gps: { Latitude: 37.7749, Longitude: -122.4194 },
    } as never)

    const result = await extractExifFromImage(makeFile())

    expect(result.coords).toEqual({ lat: 37.7749, lng: -122.4194 })
  })

  it('returns null coords when no GPS data is present', async () => {
    vi.mocked(ExifReader.load).mockReturnValue({} as never)

    const result = await extractExifFromImage(makeFile())

    expect(result.coords).toBeNull()
  })

  it('returns null coords when EXIF parsing throws', async () => {
    vi.mocked(ExifReader.load).mockImplementation(() => {
      throw new Error('Invalid EXIF')
    })

    const result = await extractExifFromImage(makeFile())

    expect(result.coords).toBeNull()
    expect(result.takenAtLocal).toBeNull()
  })

  it('returns null coords when GPS values are not numbers', async () => {
    vi.mocked(ExifReader.load).mockReturnValue({
      gps: { Latitude: undefined, Longitude: undefined },
    } as never)

    const result = await extractExifFromImage(makeFile())

    expect(result.coords).toBeNull()
  })

  it('extracts takenAtLocal from DateTimeOriginal', async () => {
    vi.mocked(ExifReader.load).mockReturnValue({
      exif: { DateTimeOriginal: { description: '2026:03:15 12:34:56' } },
    } as never)

    const result = await extractExifFromImage(makeFile())

    expect(result.takenAtLocal).toBe('2026-03-15T12:34:56')
  })

  it('returns null takenAtLocal when no date fields exist', async () => {
    vi.mocked(ExifReader.load).mockReturnValue({
      exif: {},
    } as never)

    const result = await extractExifFromImage(makeFile())

    expect(result.takenAtLocal).toBeNull()
  })
})
