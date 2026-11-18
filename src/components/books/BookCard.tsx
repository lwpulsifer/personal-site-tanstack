import type { JSX } from '@solidjs/web'
import { useViewTransitionNavigate, viewTransitionClick } from '../../lib/viewTransition'
import { paths } from '../../router'
import type { DbBook } from '../../server/books'
import { CoverImage } from './CoverImage'
import { StarRating } from './StarRating'

// A compact "book cover" tile: image, title, author, rating — nothing else.
// Everything else lives on the book's own page, linked from here.
export function BookCard(props: { book: DbBook; class?: string; style?: JSX.CSSProperties }) {
  const navigateWithTransition = useViewTransitionNavigate()
  const href = () => String(paths.books(props.book.id))
  return (
    <a
      href={href()}
      onClick={viewTransitionClick(navigateWithTransition, href)}
      data-testid={`book-card-${props.book.id}`}
      class={`group flex flex-col text-left no-underline transition hover:-translate-y-1 ${props.class ?? ''}`}
      style={props.style}
    >
      <CoverImage
        book={props.book}
        style={{ 'view-transition-name': `book-cover-${props.book.id}` }}
        class="aspect-[2/3] w-full rounded-lg bg-[var(--chip-bg)] shadow-md transition group-hover:shadow-xl"
      />

      <h2
        data-testid={`book-title-${props.book.id}`}
        class="m-0 mt-2 line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]"
      >
        {props.book.title}
      </h2>
      <p class="m-0 line-clamp-1 text-xs text-[var(--text-muted)]">{props.book.author}</p>
      <div class="mt-1">
        <StarRating rating={props.book.rating} />
      </div>
    </a>
  )
}
