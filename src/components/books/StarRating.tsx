const STARS = [1, 2, 3, 4, 5] as const

type StarRatingProps = {
  rating: number | null
  onChange?: (rating: number) => void
  size?: 'sm' | 'md'
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
          <button
            key={star}
            type="button"
            aria-pressed={rating === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            data-testid={`star-${star}`}
            onClick={() => onChange(star)}
            className={`leading-none transition hover:scale-110 ${
              rating != null && star <= rating
                ? 'text-amber-400'
                : 'text-[var(--text-muted)] opacity-40 hover:opacity-70'
            }`}
          >
            ★
          </button>
        ) : (
          <span
            key={star}
            aria-hidden="true"
            className={`leading-none ${
              rating != null && star <= rating ? 'text-amber-400' : 'opacity-25'
            }`}
          >
            ★
          </span>
        ),
      )}
    </div>
  )
}
