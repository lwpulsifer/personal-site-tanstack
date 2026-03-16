import ExifReader from 'exifreader'

export type GpsCoords = { lat: number; lng: number }

export type ExifExtract = {
  coords: GpsCoords | null
  /**
   * Local date-time string without timezone, formatted as `YYYY-MM-DDTHH:mm:ss`.
   * EXIF timestamps generally do not include timezone, so we intentionally
   * keep this "local" and let the server interpret it with a derived IANA zone.
   */
  takenAtLocal: string | null
}

function normalizeExifDateTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // Common EXIF format: "2026:03:15 12:34:56"
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
  // Some libraries emit ISO-ish strings already.
  const iso = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
  if (iso) return iso[1]
  return null
}

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

/**
 * Extract the most relevant EXIF date-time from an image file.
 * Returns a local datetime string (no timezone) or null.
 */
export async function extractTakenAtLocalFromImage(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer()
    const tags = ExifReader.load(buffer, { expanded: true })

    const exif = (tags as any).exif ?? {}
    const candidates = [
      exif.DateTimeOriginal?.description,
      exif.CreateDate?.description,
      exif.ModifyDate?.description,
      exif.DateTime?.description,
    ]
    for (const c of candidates) {
      const normalized = normalizeExifDateTime(c)
      if (normalized) return normalized
    }
    return null
  } catch {
    return null
  }
}

/**
 * Convenience helper to extract both GPS and date-time in a single file read.
 */
export async function extractExifFromImage(file: File): Promise<ExifExtract> {
  try {
    const buffer = await file.arrayBuffer()
    const tags = ExifReader.load(buffer, { expanded: true })
    const gps = (tags as any).gps ?? {}
    const exif = (tags as any).exif ?? {}

    const lat = gps.Latitude
    const lng = gps.Longitude
    const coords =
      typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null

    const candidates = [
      exif.DateTimeOriginal?.description,
      exif.CreateDate?.description,
      exif.ModifyDate?.description,
      exif.DateTime?.description,
    ]
    let takenAtLocal: string | null = null
    for (const c of candidates) {
      const normalized = normalizeExifDateTime(c)
      if (normalized) {
        takenAtLocal = normalized
        break
      }
    }

    return { coords, takenAtLocal }
  } catch {
    return { coords: null, takenAtLocal: null }
  }
}
