/** Check whether a File is HEIC/HEIF based on MIME type or extension. */
export function isHeicFile(file: File) {
  const name = file.name.toLowerCase()
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

/** Check whether a storage path points to a HEIC/HEIF file. */
export function isHeicPath(storagePath: string) {
  return /\.(heic|heif)$/i.test(storagePath)
}

/** Convert a HEIC/HEIF File to a JPEG File. */
export async function convertHeicFileToJpeg(file: File) {
  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  })
  const jpegBlob = Array.isArray(converted) ? converted[0] : converted
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  return new File([jpegBlob as BlobPart], newName, { type: 'image/jpeg' })
}

/** Fetch a HEIC image by URL and convert it to a JPEG blob + object URL. */
export async function convertHeicUrlToJpeg(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const blob = await res.blob()

  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({
    blob,
    toType: 'image/jpeg',
    quality: 0.9,
  })

  const jpegBlob = Array.isArray(converted) ? converted[0] : converted
  return {
    jpegBlob: jpegBlob as Blob,
    objectUrl: URL.createObjectURL(jpegBlob as Blob),
  }
}

/** Get the deterministic cached JPEG path for a HEIC storage path. */
export function getCachedJpegPath(storagePath: string) {
  return storagePath.replace(/\.(heic|heif)$/i, '.jpg')
}
