import { For, Show } from 'solid-js'

const STARS = [1, 2, 3, 4, 5] as const

// Fraction of a single star that renders filled — 0, 0.5 or 1 (half-star steps).
function starFill(star: number, rating: number | null) {
  if (rating == null) return 0
  const fill = rating - (star - 1)
  if (fill >= 1) return 1
  if (fill >= 0.5) return 0.5
  return 0
}

function StarIcon(props: { fill: 0 | 0.5 | 1 }) {
  return (
    <span aria-hidden="true" class="relative inline-block leading-none">
      <span class="text-[var(--text-muted)] opacity-40">★</span>
      <Show when={props.fill > 0}>
        <span
          class="absolute inset-0 overflow-hidden text-amber-400"
          style={{ width: props.fill === 1 ? '100%' : '50%' }}
        >
          ★
        </span>
      </Show>
    </span>
  )
}

export function StarRating(props: {
  rating: number | null
  onChange?: (rating: number) => void
  size?: 'sm' | 'md'
}) {
  const textSize = () => (props.size === 'md' ? 'text-xl' : 'text-sm')

  return (
    <Show when={!!props.onChange || props.rating}>
      <div
        class={`flex items-center gap-0.5 ${textSize()}`}
        role={props.onChange ? 'group' : 'img'}
        aria-label={props.onChange ? 'Rating' : `Rated ${props.rating} out of 5`}
      >
        <For each={STARS}>
          {(star) => (
            <Show
              when={props.onChange}
              fallback={<StarIcon fill={starFill(star, props.rating)} />}
            >
              <span class="relative inline-block leading-none">
                <StarIcon fill={starFill(star, props.rating)} />
                <button
                  type="button"
                  aria-pressed={props.rating === star - 0.5 ? 'true' : 'false'}
                  aria-label={`${star - 0.5} stars`}
                  data-testid={`star-${star}-half`}
                  onClick={() => props.onChange?.(star - 0.5)}
                  class="absolute inset-y-0 left-0 w-1/2"
                />
                <button
                  type="button"
                  aria-pressed={props.rating === star ? 'true' : 'false'}
                  aria-label={`${star} star${star === 1 ? '' : 's'}`}
                  data-testid={`star-${star}`}
                  onClick={() => props.onChange?.(star)}
                  class="absolute inset-y-0 right-0 w-1/2"
                />
              </span>
            </Show>
          )}
        </For>
      </div>
    </Show>
  )
}
