import { useState } from 'react'

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
  const src = `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`

  const [isLoaded, setIsLoaded] = useState(false)
  const [hasErrored, setHasErrored] = useState(false)

  return (
    <div className="relative">
      {!isLoaded && !hasErrored && (
        <div
          data-testid="storage-image-loading"
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-[var(--surface)]"
        >
          <div className="h-full w-full animate-pulse rounded-lg bg-[color-mix(in_oklab,var(--surface),var(--text)_6%)]" />
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
          onError={() => setHasErrored(true)}
        />
      )}
    </div>
  )
}
