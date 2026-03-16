import { useEffect, useMemo, useState } from 'react'

function isHeicPath(storagePath: string) {
  return /\.(heic|heif)$/i.test(storagePath)
}

async function convertHeicUrlToJpegObjectUrl(url: string) {
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
  return URL.createObjectURL(jpegBlob as Blob)
}

export function StorageImage({
  bucket,
  storagePath,
  alt,
  className,
  loading = 'lazy',
  onClick,
}: {
  bucket: string
  storagePath: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  onClick?: React.MouseEventHandler<HTMLImageElement>
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

  const publicUrl = useMemo(() => {
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`
  }, [bucket, storagePath, supabaseUrl])

  const [src, setSrc] = useState(publicUrl)
  const [hasErrored, setHasErrored] = useState(false)
  const [fallbackTried, setFallbackTried] = useState(false)

  useEffect(() => {
    setSrc(publicUrl)
    setHasErrored(false)
    setFallbackTried(false)
  }, [publicUrl])

  // Clean up object URLs we create for converted images.
  useEffect(() => {
    return () => {
      if (src.startsWith('blob:')) URL.revokeObjectURL(src)
    }
  }, [src])

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onClick={onClick}
      onError={async () => {
        // Many browsers can't render HEIC/HEIF. If we detect it, fetch + convert client-side.
        if (!fallbackTried && isHeicPath(storagePath)) {
          setFallbackTried(true)
          try {
            const objectUrl = await convertHeicUrlToJpegObjectUrl(publicUrl)
            setSrc(objectUrl)
            return
          } catch {
            // Fall through to error UI
          }
        }
        setHasErrored(true)
      }}
      data-errored={hasErrored ? 'true' : 'false'}
    />
  )
}
