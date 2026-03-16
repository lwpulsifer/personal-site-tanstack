import { useQuery } from '@tanstack/react-query'
import { mapPhotosQueryOptions } from '#/lib/queries'
import { useEffect, useRef, useState } from 'react'
import { StorageImage } from './StorageImage'
import { createPortal } from 'react-dom'

export function PhotoGallery({ locationId }: { locationId: string }) {
  const { data: photos = [], isLoading } = useQuery(mapPhotosQueryOptions(locationId))
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (lightboxIndex !== null) {
      lastActiveElementRef.current = document.activeElement as HTMLElement | null
      overlayRef.current?.focus()
    }
  }, [lightboxIndex])

  useEffect(() => {
    if (lightboxIndex === null) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      // Restore focus to whatever opened the modal (best-effort).
      lastActiveElementRef.current?.focus?.()
    }
  }, [lightboxIndex])

  if (isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading photos...</p>
  }

  if (photos.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No photos yet.</p>
  }

  return (
    <>
      {/* Full-width “drawer” gallery layout */}
      <div className="space-y-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(i)}
            data-testid={`location-photo-${i}`}
            className="group w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <StorageImage
                bucket="map-photos"
                storagePath={photo.storage_path}
                alt={photo.caption ?? 'Lion statue photo'}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            </div>
            {photo.caption && (
              <div className="border-t border-[var(--border)] px-3 py-2">
                <p className="m-0 text-xs text-[var(--text-muted)]">{photo.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {lightboxIndex !== null && typeof document !== 'undefined' && createPortal((
        <div
          ref={overlayRef}
          tabIndex={-1}
          data-testid="photo-carousel-modal"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxIndex(null)
            if (e.key === 'ArrowRight') setLightboxIndex((i) => i !== null ? Math.min(i + 1, photos.length - 1) : null)
            if (e.key === 'ArrowLeft') setLightboxIndex((i) => i !== null ? Math.max(i - 1, 0) : null)
          }}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            data-testid="carousel-close"
            aria-label="Close"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-3xl text-white hover:bg-black/60"
          >
            &times;
          </button>

          <button
            type="button"
            data-testid="carousel-prev"
            aria-label="Previous photo"
            disabled={lightboxIndex === 0}
            onClick={(e) => {
              e.stopPropagation()
              setLightboxIndex((i) => (i !== null ? Math.max(i - 1, 0) : null))
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white hover:bg-black/60 disabled:opacity-40"
          >
            Prev
          </button>

          <button
            type="button"
            data-testid="carousel-next"
            aria-label="Next photo"
            disabled={lightboxIndex === photos.length - 1}
            onClick={(e) => {
              e.stopPropagation()
              setLightboxIndex((i) => (i !== null ? Math.min(i + 1, photos.length - 1) : null))
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white hover:bg-black/60 disabled:opacity-40"
          >
            Next
          </button>

          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white">
            {lightboxIndex + 1} / {photos.length}
          </div>

          <div
            className="mx-auto flex w-[92vw] max-w-[1100px] items-center justify-center px-4 pb-10 pt-16"
            onClick={(e) => e.stopPropagation()}
          >
            <StorageImage
              bucket="map-photos"
              storagePath={photos[lightboxIndex].storage_path}
              alt={photos[lightboxIndex].caption ?? 'Lion statue photo'}
              loading="eager"
              className="h-auto w-auto max-h-[78vh] max-w-full rounded-xl object-contain"
            />
          </div>
          {photos[lightboxIndex].caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-white">
              {photos[lightboxIndex].caption}
            </p>
          )}
        </div>
      ), document.body)}
    </>
  )
}
