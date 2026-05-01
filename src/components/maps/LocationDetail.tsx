import type { MapLocation } from '#/lib/map-types'
import { PhotoGallery } from './PhotoGallery'

export function LocationDetail({
  location,
  onClose,
  onAddPhotos,
}: {
  location: MapLocation
  onClose: () => void
  onAddPhotos?: (location: MapLocation) => void
}) {
  return (
    <div data-testid="location-detail" className="island-shell flex h-full flex-col overflow-y-auto rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 data-testid="location-detail-name" className="m-0 text-xl font-bold text-[var(--text)]">{location.name}</h2>
          {location.address && (
            <p className="m-0 mt-1 text-sm text-[var(--text-muted)]">{location.address}</p>
          )}
        </div>
        <button
          type="button"
          data-testid="location-detail-close"
          onClick={onClose}
          className="shrink-0 rounded-full p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <title>Close</title>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {onAddPhotos && (
        <button
          type="button"
          data-testid="add-photos-btn"
          onClick={() => onAddPhotos(location)}
          className="mb-4 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--blue)]"
        >
          + Add photos
        </button>
      )}

      {location.description && (
        <p className="mb-4 text-sm text-[var(--text-muted)]">{location.description}</p>
      )}

      <p className="mb-2 text-xs text-[var(--text-muted)]">
        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
      </p>

      <div className="flex-1">
        <h3 data-testid="photos-heading" className="mb-2 text-sm font-semibold text-[var(--text)]">Photos</h3>
        <PhotoGallery locationId={location.id} />
      </div>
    </div>
  )
}
