const STARS = [1, 2, 3, 4, 5] as const

type StarRatingProps = {
  rating: number | null
  onChange?: (rating: number) => void
  size?: 'sm' | 'md'
}

// Fraction of a single star that should render filled, given the overall
// rating — 0, 0.5, or 1 since ratings are constrained to half-star steps.
function starFill(star: number, rating: number | null) {
  if (rating == null) return 0
  const fill = rating - (star - 1)
  if (fill >= 1) return 1
  if (fill >= 0.5) return 0.5
  return 0
}

function StarIcon({ fill }: { fill: 0 | 0.5 | 1 }) {
  return (
    <span aria-hidden="true" className="relative inline-block leading-none">
      <span className="text-[var(--text-muted)] opacity-40">★</span>
      {fill > 0 && (
        <span
          className="absolute inset-0 overflow-hidden text-amber-400"
          style={{ width: fill === 1 ? '100%' : '50%' }}
        >
          ★
        </span>
      )}
    </span>
  )
}

export function StarRating({ rating, onChange, size = 'sm' }: StarRatingProps) {
  const interactive = !!onChange
  const textSize = size === 'sm' ? 'text-sm' : 'text-xl'

  if (!interactive && !rating) return null

  return (
    <div
      className={`flex items-center gap-0.5 ${textSize}`}
      {...(interactive
        ? { role: 'group', 'aria-label': 'Rating' }
        : { role: 'img', 'aria-label': `Rated ${rating} out of 5` })}
    >
      {STARS.map((star) =>
        interactive ? (
          <span key={star} className="relative inline-block leading-none">
            <StarIcon fill={starFill(star, rating)} />
            <button
              type="button"
              aria-pressed={rating === star - 0.5}
              aria-label={`${star - 0.5} stars`}
              data-testid={`star-${star}-half`}
              onClick={() => onChange(star - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              aria-pressed={rating === star}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              data-testid={`star-${star}`}
              onClick={() => onChange(star)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        ) : (
          <StarIcon key={star} fill={starFill(star, rating)} />
        ),
      )}
    </div>
  )
}
