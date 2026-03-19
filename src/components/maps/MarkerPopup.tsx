import type { MapLocation } from '#/lib/map-types'

export function MarkerPopup({
  location,
  onViewDetails,
}: {
  location: MapLocation
  onViewDetails?: () => void
}) {
  return (
    <div className="min-w-[180px]">
      <h3 className="m-0 text-sm font-bold text-gray-900">{location.name}</h3>
      {location.address && (
        <p className="m-0 mt-1 text-xs text-gray-600">{location.address}</p>
      )}
      {location.description && (
        <p className="m-0 mt-1 text-xs text-gray-500">{location.description}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {location.photo_count} photo{location.photo_count !== 1 ? 's' : ''}
        </span>
        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  )
}
