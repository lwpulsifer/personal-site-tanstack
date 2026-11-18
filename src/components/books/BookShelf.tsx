import { createSignal, For, Show } from 'solid-js'
import type { DbBook } from '../../server/books'
import { BookCard } from './BookCard'
import { CoverImage } from './CoverImage'

const GRID_CLASSES = 'grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'

// Degrees each successive cover fans out from center, so a 3-cover stack
// spreads -7/0/+7 degrees and looks like a loosely spread pile of books.
const FAN_ROTATE_STEP_DEG = 7
const MAX_STACKED_COVERS = 3

function StackedCovers(props: { books: DbBook[] }) {
  const covers = () => props.books.slice(0, MAX_STACKED_COVERS)
  return (
    <div class="relative h-20 w-14 flex-shrink-0">
      <For each={covers()}>
        {(book, i) => (
          <div
            class="absolute inset-0"
            style={{
              transform: `rotate(${(i() - (covers().length - 1) / 2) * FAN_ROTATE_STEP_DEG}deg) translateX(${i() * 3}px)`,
              'z-index': i(),
            }}
          >
            <CoverImage
              book={book}
              iconClass="text-lg"
              class="h-full w-full rounded-md bg-[var(--chip-bg)] shadow-md ring-1 ring-black/10"
            />
          </div>
        )}
      </For>
    </div>
  )
}

type BookShelfProps = {
  label: string
  shelfKey: string
  books: DbBook[]
  defaultOpen: boolean
  // Caps how many cards render initially when expanded, with a "Show more"
  // button to reveal the rest. Unlimited if omitted.
  maxVisible?: number
}

// A collapsible "shelf" of books. Collapsed, it renders as a stack of fanned
// covers you can click to expand into a full-width grid.
export function BookShelf(props: BookShelfProps) {
  const [isOpen, setIsOpen] = createSignal(props.defaultOpen)
  const [showAll, setShowAll] = createSignal(false)

  const isTruncated = () =>
    !!props.maxVisible && !showAll() && props.books.length > props.maxVisible
  const visibleBooks = () => (isTruncated() ? props.books.slice(0, props.maxVisible) : props.books)

  return (
    <Show when={props.books.length > 0}>
      <section class="mb-10">
        <button
          type="button"
          data-testid={`shelf-toggle-${props.shelfKey}`}
          aria-expanded={isOpen() ? 'true' : 'false'}
          onClick={() => setIsOpen((prev) => !prev)}
          class="mb-3 flex items-center gap-2"
        >
          <span class="island-kicker">{props.label}</span>
          <span class="text-xs text-[var(--text-muted)]">({props.books.length})</span>
          <span
            aria-hidden="true"
            class={`text-xs text-[var(--text-muted)] transition-transform ${isOpen() ? 'rotate-90' : ''}`}
          >
            ›
          </span>
        </button>

        <Show
          when={isOpen()}
          fallback={
            <button
              type="button"
              data-testid={`shelf-stack-${props.shelfKey}`}
              onClick={() => setIsOpen(true)}
              class="flex items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--chip-bg)] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <StackedCovers books={props.books} />
              <span class="pb-1 text-sm text-[var(--text-muted)]">
                {props.books.length} book{props.books.length === 1 ? '' : 's'} — tap to expand
              </span>
            </button>
          }
        >
          <div data-testid={`shelf-books-${props.shelfKey}`} class={GRID_CLASSES}>
            <For each={visibleBooks()}>
              {(book, i) => (
                <BookCard book={book} class="rise-in" style={{ 'animation-delay': `${i() * 60}ms` }} />
              )}
            </For>
          </div>

          <Show when={isTruncated()}>
            <button
              type="button"
              data-testid={`shelf-show-more-${props.shelfKey}`}
              onClick={() => setShowAll(true)}
              class="mt-4 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              Show {props.books.length - (props.maxVisible ?? 0)} more →
            </button>
          </Show>
        </Show>
      </section>
    </Show>
  )
}
