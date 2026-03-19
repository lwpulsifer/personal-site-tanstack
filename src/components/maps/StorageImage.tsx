import { useMemo, useReducer } from 'react'
import { getSupabaseBrowserClient } from '#/lib/supabase'
import { isHeicPath, getCachedJpegPath, convertHeicUrlToJpeg } from '#/lib/heic'
import { useRevokeObjectUrl } from '#/lib/hooks/useRevokeObjectUrl'

type ImageState = {
  src: string
  status: 'loading' | 'loaded' | 'converting' | 'errored'
  fallbackTried: boolean
}

type ImageAction =
  | { type: 'LOADED' }
  | { type: 'CONVERTING' }
  | { type: 'CONVERTED'; objectUrl: string }
  | { type: 'CACHED'; cachedUrl: string }
  | { type: 'ERRORED' }

function imageReducer(state: ImageState, action: ImageAction): ImageState {
  switch (action.type) {
    case 'LOADED':
      return { ...state, status: 'loaded' }
    case 'CONVERTING':
      return { ...state, status: 'converting', fallbackTried: true }
    case 'CONVERTED':
      return { ...state, src: action.objectUrl, status: 'loading' }
    case 'CACHED':
      return { ...state, src: action.cachedUrl, status: 'loading' }
    case 'ERRORED':
      return { ...state, status: 'errored' }
  }
}

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
    const initialUrl = cachedJpegUrl ?? originalUrl
    return { originalUrl, cachedJpegPath, cachedJpegUrl, initialUrl }
  }, [bucket, storagePath, supabaseUrl])

  const [state, dispatch] = useReducer(imageReducer, {
    src: initialUrl,
    status: 'loading',
    fallbackTried: false,
  })

  // Clean up blob URLs we create for converted images.
  const blobUrl = state.src.startsWith('blob:') ? state.src : null
  useRevokeObjectUrl(blobUrl)

  return (
    <div className="relative">
      {state.status !== 'loaded' && state.status !== 'errored' && (
        <div
          data-testid="storage-image-loading"
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-[var(--surface)]"
        >
          <div className="h-full w-full animate-pulse rounded-lg bg-[color-mix(in_oklab,var(--surface),var(--text)_6%)]" />
          {state.status === 'converting' && (
            <span className="pointer-events-none absolute text-xs font-semibold text-[var(--text-muted)]">
              Converting…
            </span>
          )}
        </div>
      )}

      {state.status === 'errored' ? (
        <div
          data-testid="storage-image-error"
          className="flex h-full w-full items-center justify-center rounded-lg bg-[var(--surface)] text-xs text-[var(--text-muted)]"
        >
          Image unavailable
        </div>
      ) : (
        <img
          src={state.src}
          alt={alt}
          width={width}
          height={height}
          className={`${className ?? ''} transition-opacity duration-300 ${state.status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          loading={loading}
          onClick={onClick}
          onLoad={() => dispatch({ type: 'LOADED' })}
          onError={async () => {
            if (!state.fallbackTried && isHeicPath(storagePath) && cachedJpegPath && cachedJpegUrl) {
              dispatch({ type: 'CONVERTING' })
              try {
                const { objectUrl, jpegBlob } = await convertHeicUrlToJpeg(originalUrl)
                dispatch({ type: 'CONVERTED', objectUrl })

                // Best-effort cache upload
                try {
                  const supabase = getSupabaseBrowserClient()
                  const { error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(cachedJpegPath, jpegBlob, {
                      contentType: 'image/jpeg',
                      upsert: false,
                    })
                  if (uploadError && (uploadError as any).statusCode !== 409) {
                    throw uploadError
                  }
                  dispatch({ type: 'CACHED', cachedUrl: cachedJpegUrl })
                } catch {
                  // Ignore caching failures; viewer still sees converted blob.
                }
                return
              } catch {
                // Fall through to error UI
              }
            }
            dispatch({ type: 'ERRORED' })
          }}
        />
      )}
    </div>
  )
}
