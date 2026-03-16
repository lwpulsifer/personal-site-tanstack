import ExifReader from 'exifreader'

export type GpsCoords = { lat: number; lng: number }

/**
 * Extract GPS coordinates from an image file's EXIF data.
 * Returns null if no GPS data is found.
 */
export async function extractGpsFromImage(file: File): Promise<GpsCoords | null> {
  try {
    const buffer = await file.arrayBuffer()
    const tags = ExifReader.load(buffer, { expanded: true })

    const lat = tags.gps?.Latitude
    const lng = tags.gps?.Longitude

    if (typeof lat !== 'number' || typeof lng !== 'number') return null

    return { lat, lng }
  } catch {
    return null
  }
}
