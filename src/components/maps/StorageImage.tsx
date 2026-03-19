import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '#/lib/supabase'
import { isHeicPath, getCachedJpegPath, convertHeicUrlToJpeg } from '#/lib/heic'

export function StorageImage({
  bucket,
  storagePath,
  alt,
  className,
  loading = 'lazy',
  onClick,
  width,
  height,
}: {
  bucket: string
  storagePath: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  onClick?: React.MouseEventHandler<HTMLImageElement>
  width?: number
  height?: number
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

  const { originalUrl, cachedJpegPath, cachedJpegUrl, initialUrl } = useMemo(() => {
    const originalUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`
    const cachedJpegPath = isHeicPath(storagePath) ? getCachedJpegPath(storagePath) : null
    const cachedJpegUrl = cachedJpegPath
      ? `${supabaseUrl}/storage/v1/object/public/${bucket}/${cachedJpegPath}`
      : null
    // Prefer the cached JPEG for HEIC paths. If it 404s, we'll convert and upload.
    const initialUrl = cachedJpegUrl ?? originalUrl
    return { originalUrl, cachedJpegPath, cachedJpegUrl, initialUrl }
  }, [bucket, storagePath, supabaseUrl])

  const [src, setSrc] = useState(initialUrl)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasErrored, setHasErrored] = useState(false)
  const [fallbackTried, setFallbackTried] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  useEffect(() => {
    setSrc(initialUrl)
    setIsLoaded(false)
    setHasErrored(false)
    setFallbackTried(false)
    setIsConverting(false)
  }, [initialUrl])

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
          width={width}
          height={height}
          className={`${className ?? ''} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading={loading}
          onClick={onClick}
          onLoad={() => setIsLoaded(true)}
          onError={async () => {
            // Many browsers can't render HEIC/HEIF. If we detect it, fetch + convert client-side.
            // If conversion succeeds and we can upload, cache it as a JPEG for future viewers.
            if (!fallbackTried && isHeicPath(storagePath) && cachedJpegPath && cachedJpegUrl) {
              setFallbackTried(true)
              setIsConverting(true)
              try {
                const { objectUrl, jpegBlob } = await convertHeicUrlToJpeg(originalUrl)
                setIsConverting(false)
                setSrc(objectUrl)

                // Best-effort cache upload. This will succeed for authenticated users
                // (or if bucket policies allow) and silently no-op otherwise.
                try {
                  const supabase = getSupabaseBrowserClient()
                  const { error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(cachedJpegPath, jpegBlob, {
                      contentType: 'image/jpeg',
                      upsert: false,
                    })
                  // 409 = already exists; treat as success.
                  if (uploadError && (uploadError as any).statusCode !== 409) {
                    throw uploadError
                  }
                  // Swap to the stable public URL once the cached image exists.
                  setSrc(cachedJpegUrl)
                } catch {
                  // Ignore caching failures; viewer still sees converted blob.
                }
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
