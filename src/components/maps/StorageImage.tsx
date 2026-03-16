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
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasErrored, setHasErrored] = useState(false)
  const [fallbackTried, setFallbackTried] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  useEffect(() => {
    setSrc(publicUrl)
    setIsLoaded(false)
    setHasErrored(false)
    setFallbackTried(false)
    setIsConverting(false)
  }, [publicUrl])

  // Clean up object URLs we create for converted images.
  useEffect(() => {
    return () => {
      if (src.startsWith('blob:')) URL.revokeObjectURL(src)
    }
  }, [src])

  return (
    <div className="relative">
      {!hasErrored && !isLoaded && (
        <div
          data-testid="storage-image-loading"
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-[var(--surface)]"
        >
          <div className="h-full w-full animate-pulse rounded-lg bg-[color-mix(in_oklab,var(--surface),var(--text)_6%)]" />
          {isConverting && (
            <span className="pointer-events-none absolute text-xs font-semibold text-[var(--text-muted)]">
              Converting…
            </span>
          )}
        </div>
      )}

      {hasErrored ? (
        <div
          data-testid="storage-image-error"
          className="flex h-full w-full items-center justify-center rounded-lg bg-[var(--surface)] text-xs text-[var(--text-muted)]"
        >
          Image unavailable
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`${className ?? ''} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading={loading}
          onClick={onClick}
          onLoad={() => setIsLoaded(true)}
          onError={async () => {
            // Many browsers can't render HEIC/HEIF. If we detect it, fetch + convert client-side.
            if (!fallbackTried && isHeicPath(storagePath)) {
              setFallbackTried(true)
              setIsConverting(true)
              try {
                const objectUrl = await convertHeicUrlToJpegObjectUrl(publicUrl)
                setIsConverting(false)
                setSrc(objectUrl)
                return
              } catch {
                setIsConverting(false)
                // Fall through to error UI
              }
            }
            setHasErrored(true)
          }}
          data-errored={hasErrored ? 'true' : 'false'}
        />
      )}
    </div>
  )
}
