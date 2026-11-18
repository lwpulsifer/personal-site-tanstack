import { Link, Meta, Title } from '@solidjs/meta'
import { type RouteDefinition, type RouteSectionProps, useNavigate, useParams } from '@solidjs/router'
import { httpStatus } from '@solidjs/web'
import { createMemo, createSignal, Show } from 'solid-js'
import { AdminActions } from '../../components/books/AdminActions'
import { CoverImage } from '../../components/books/CoverImage'
import { ReviewText, redactSpoilers } from '../../components/books/SpoilerText'
import { StarRating } from '../../components/books/StarRating'
import { NotFound } from '../../components/NotFound'
import { useAuth } from '../../lib/auth'
import { STATUS_LABEL, STATUS_STYLES } from '../../lib/books'
import { useViewTransitionNavigate, viewTransitionClick } from '../../lib/viewTransition'
import { getOpenLibraryCoverUrl, isLookupableIsbn, normalizeIsbn } from '../../lib/openLibrary'
import { SITE_TITLE, SITE_URL } from '../../lib/site'
import { paths } from '../../router'
import { type DbBook, getBook } from '../../server/books'

export const route = {
  preload: async ({ params }) => {
    if (!(await getBook(params.bookId ?? ''))) httpStatus(404)
  },
} satisfies RouteDefinition

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// Same cover-resolution logic as CoverImage, but returning a plain URL for og:image.
function resolveCoverUrl(book: Pick<DbBook, 'cover_url' | 'isbn'>): string | null {
  if (book.cover_url) return book.cover_url
  const cleanIsbn = book.isbn ? normalizeIsbn(book.isbn) : ''
  return isLookupableIsbn(cleanIsbn) ? getOpenLibraryCoverUrl(cleanIsbn) : null
}

function BookView(props: { bookId: string; children: RouteSectionProps['children'] }) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const navigateWithTransition = useViewTransitionNavigate()
  const [copyStatus, setCopyStatus] = createSignal<'idle' | 'copied'>('idle')
  const book = createMemo(() => getBook(props.bookId))

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/books/${props.bookId}`)
      setCopyStatus('copied')
    } catch {
      // Clipboard access can be denied; the URL is still in the address bar.
    }
  }

  return (
    <Show when={book()} fallback={<NotFound />}>
      {(b) => (
        <>
          <Title>{`${b().title} by ${b().author} — ${SITE_TITLE}`}</Title>
          <Link rel="canonical" href={`${SITE_URL}/books/${props.bookId}`} />
          <Meta
            name="description"
            content={
              b().review
                ? redactSpoilers(b().review!).slice(0, 200)
                : `${b().title} by ${b().author}, on Liam's reading list.`
            }
          />
          <Show when={resolveCoverUrl(b())}>
            {(image) => <Meta property="og:image" content={image()} />}
          </Show>

          {/* The edit overlay (child route) renders here; the detail content below
              stays mounted across that navigation. */}
          {props.children}

          <main class="page-wrap flex justify-center px-4 pb-12 pt-16">
            <article
              data-testid="book-page"
              class="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl sm:p-8"
            >
              <div class="mb-6 flex items-center justify-between border-b border-[var(--border)] pb-4">
                <a
                  href={String(paths.books())}
                  onClick={viewTransitionClick(navigateWithTransition, () => String(paths.books()))}
                  data-testid="book-back-link"
                  class="text-sm font-semibold text-[var(--blue-deep)] no-underline hover:underline"
                >
                  ← Back to all books
                </a>

                <button
                  type="button"
                  onClick={copyLink}
                  data-testid="book-copy-link-btn"
                  aria-label={copyStatus() === 'copied' ? 'Link copied' : 'Copy link to share'}
                  title={copyStatus() === 'copied' ? 'Link copied!' : 'Copy link to share'}
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
                >
                  {copyStatus() === 'copied' ? '✓' : '🔗'}
                </button>
              </div>

              <div class="flex gap-5">
                <CoverImage
                  book={b()}
                  style={{ 'view-transition-name': `book-cover-${b().id}` }}
                  class="h-56 w-36 flex-shrink-0 rounded-lg bg-[var(--chip-bg)] shadow-md sm:h-64 sm:w-44"
                />

                <div class="min-w-0">
                  <span
                    class={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[b().status]}`}
                  >
                    {STATUS_LABEL[b().status]}
                  </span>
                  <h1
                    data-testid="book-page-title"
                    class="display-title m-0 text-2xl font-bold leading-snug text-[var(--text)] sm:text-3xl"
                  >
                    {b().title}
                  </h1>
                  <p class="m-0 mt-1 text-sm text-[var(--text-muted)]">{b().author}</p>
                  <Show when={b().rating != null}>
                    <div class="mt-2">
                      <StarRating rating={b().rating} />
                    </div>
                  </Show>
                </div>
              </div>

              <dl class="mb-4 mt-6 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)] sm:w-64">
                <Show when={b().started_at}>
                  {(d) => (
                    <div>
                      <dt class="font-semibold text-[var(--text)]">Started</dt>
                      <dd class="m-0">{formatDate(d())}</dd>
                    </div>
                  )}
                </Show>
                <Show when={b().finished_at}>
                  {(d) => (
                    <div>
                      <dt class="font-semibold text-[var(--text)]">Finished</dt>
                      <dd class="m-0">{formatDate(d())}</dd>
                    </div>
                  )}
                </Show>
              </dl>

              <div>
                <p class="mb-1 text-xs font-semibold text-[var(--text-muted)]">Review</p>
                <Show
                  when={b().review}
                  fallback={<p class="text-sm italic text-[var(--text-muted)]">No review yet.</p>}
                >
                  {(review) => (
                    <p
                      data-testid="book-page-review"
                      class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]"
                    >
                      <ReviewText text={review()} />
                    </p>
                  )}
                </Show>
              </div>

              <Show when={isAuthenticated()}>
                <AdminActions
                  book={b()}
                  onEdit={() => navigateWithTransition(String(paths.books(props.bookId).edit()))}
                  onDeleted={() => navigate(paths.books())}
                />
              </Show>
            </article>
          </main>
        </>
      )}
    </Show>
  )
}

export default function BookPage(props: RouteSectionProps) {
  const params = useParams()
  return <BookView bookId={params.bookId ?? ''}>{props.children}</BookView>
}
