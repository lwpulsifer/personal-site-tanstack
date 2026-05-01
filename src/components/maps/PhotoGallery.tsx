import { useQuery } from '@tanstack/react-query'
import { mapPhotosQueryOptions } from '#/lib/queries'
import { StorageImage } from './StorageImage'
import { createPortal } from 'react-dom'
import { useLightbox } from '#/lib/hooks/useLightbox'

export function PhotoGallery({ locationId }: { locationId: string }) {
  const { data: photos = [], isLoading } = useQuery(mapPhotosQueryOptions(locationId))
  const lightbox = useLightbox(photos.length)

  if (isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading photos...</p>
  }

  if (photos.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No photos yet.</p>
  }

  return (
    <>
      {/* Full-width "drawer" gallery layout */}
      <div className="space-y-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => lightbox.open(i)}
            data-testid={`location-photo-${i}`}
            className="group w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <StorageImage
                bucket="map-photos"
                storagePath={photo.storage_path}
                alt={photo.caption ?? 'Lion statue photo'}
                className="h-full w-full object-cover transition group-hover:scale-105"
                width={200}
                height={200}
              />
            </div>
            {(photo.caption || photo.submitted_by) && (
              <div className="border-t border-[var(--border)] px-3 py-2">
                {photo.caption && <p className="m-0 text-xs text-[var(--text-muted)]">{photo.caption}</p>}
                {photo.submitted_by && <p className="m-0 text-xs text-[var(--text-muted)]">Spotted by {photo.submitted_by}</p>}
              </div>
            )}
          </button>
        ))}
      </div>

      {lightbox.isOpen && lightbox.index !== null && typeof document !== 'undefined' && createPortal((
        <div
          ref={lightbox.overlayRef}
          tabIndex={-1}
          data-testid="photo-carousel-modal"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
          onClick={lightbox.close}
          onKeyDown={lightbox.onKeyDown}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={lightbox.close}
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
            disabled={lightbox.index === 0}
            onClick={(e) => {
              e.stopPropagation()
              lightbox.prev()
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white hover:bg-black/60 disabled:opacity-40"
          >
            Prev
          </button>

          <button
            type="button"
            data-testid="carousel-next"
            aria-label="Next photo"
            disabled={lightbox.index === photos.length - 1}
            onClick={(e) => {
              e.stopPropagation()
              lightbox.next()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white hover:bg-black/60 disabled:opacity-40"
          >
            Next
          </button>

          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white">
            {lightbox.index + 1} / {photos.length}
          </div>

          {/* biome-ignore lint/a11y/noStaticElementInteractions: lightbox wrapper needs to stop propagation without being a focusable element */}
          <div
            className="mx-auto flex w-[92vw] max-w-[1100px] items-center justify-center px-4 pb-10 pt-16"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation() }}
          >
            <StorageImage
              bucket="map-photos"
              storagePath={photos[lightbox.index].storage_path}
              alt={photos[lightbox.index].caption ?? 'Lion statue photo'}
              loading="eager"
              className="h-auto w-auto max-h-[78vh] max-w-full rounded-xl object-contain"
            />
          </div>
          {(photos[lightbox.index].caption || photos[lightbox.index].submitted_by) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-center">
              {photos[lightbox.index].caption && (
                <p className="m-0 text-sm text-white">{photos[lightbox.index].caption}</p>
              )}
              {photos[lightbox.index].submitted_by && (
                <p className="m-0 text-xs text-white/70">Spotted by {photos[lightbox.index].submitted_by}</p>
              )}
            </div>
          )}
        </div>
      ), document.body)}
    </>
  )
}
