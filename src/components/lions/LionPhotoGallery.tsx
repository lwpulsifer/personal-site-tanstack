import { useQuery } from '@tanstack/react-query'
import { lionPhotosQueryOptions } from '#/lib/queries'
import { useState } from 'react'

export function LionPhotoGallery({ locationId }: { locationId: string }) {
  const { data: photos = [], isLoading } = useQuery(lionPhotosQueryOptions(locationId))
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading photos...</p>
  }

  if (photos.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No photos yet.</p>
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

  function getPhotoUrl(storagePath: string) {
    return `${supabaseUrl}/storage/v1/object/public/lion-photos/${storagePath}`
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)]"
          >
            <img
              src={getPhotoUrl(photo.storage_path)}
              alt={photo.caption ?? 'Lion statue photo'}
              className="h-full w-full object-cover transition group-hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxIndex(null)
            if (e.key === 'ArrowRight') setLightboxIndex((i) => i !== null ? Math.min(i + 1, photos.length - 1) : null)
            if (e.key === 'ArrowLeft') setLightboxIndex((i) => i !== null ? Math.max(i - 1, 0) : null)
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-2xl text-white hover:text-gray-300"
          >
            &times;
          </button>
          <img
            src={getPhotoUrl(photos[lightboxIndex].storage_path)}
            alt={photos[lightboxIndex].caption ?? 'Lion statue photo'}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {photos[lightboxIndex].caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-white">
              {photos[lightboxIndex].caption}
            </p>
          )}
        </div>
      )}
    </>
  )
}
