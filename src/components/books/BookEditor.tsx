import { createMemo, createSignal, createUniqueId, For, Show } from 'solid-js'
import { createDebounced } from '../../lib/hooks/createDebounced'
import { createLookup } from '../../lib/hooks/createLookup'
import { onEscapeKey } from '../../lib/hooks/onEscapeKey'
import {
  getOpenLibraryCoverUrlById,
  isLookupableIsbn,
  normalizeIsbn,
} from '../../lib/openLibrary'
import {
  type BookStatus,
  type DbBook,
  deleteBook,
  type UpsertBookInput,
  upsertBook,
} from '../../server/books'
import { createEditorFormatting, ToolbarButton } from '../blog/EditorToolbar'
import { CoverImage } from './CoverImage'
import { ReviewText } from './SpoilerText'
import { StarRating } from './StarRating'

export type BookEditorInitial = {
  id?: string
  title?: string
  author?: string
  isbn?: string
  cover_url?: string
  status?: BookStatus
  rating?: number | null
  review?: string
  started_at?: string | null
  finished_at?: string | null
}

export function bookToEditorInitial(book: DbBook): BookEditorInitial {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn ?? '',
    cover_url: book.cover_url ?? '',
    status: book.status,
    rating: book.rating,
    review: book.review ?? '',
    started_at: book.started_at,
    finished_at: book.finished_at,
  }
}

type Props = {
  initial: BookEditorInitial
  onClose: () => void
  onSaved: (book: DbBook) => void
  onDeleted: () => void
}

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'WANT_TO_READ', label: 'Want to Read' },
  { value: 'READING', label: 'Reading' },
  { value: 'READ', label: 'Read' },
]

type OpenLibraryBook = { title?: string; authors?: { name: string }[] }

async function fetchIsbnLookup(cleanIsbn: string, signal: AbortSignal): Promise<OpenLibraryBook | null> {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&jscmd=data&format=json`,
    { signal },
  )
  if (!res.ok) throw new Error('Lookup request failed')
  const data = (await res.json()) as Record<string, OpenLibraryBook>
  return data[`ISBN:${cleanIsbn}`] ?? null
}

type TitleSearchResult = {
  key: string
  title: string
  author: string
  isbn?: string
  coverId?: number
}

async function fetchTitleSearch(query: string, signal: AbortSignal): Promise<TitleSearchResult[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&fields=key,title,author_name,isbn,cover_i&limit=5`,
    { signal },
  )
  if (!res.ok) throw new Error('Search request failed')
  const data = (await res.json()) as {
    docs?: { key: string; title: string; author_name?: string[]; isbn?: string[]; cover_i?: number }[]
  }
  return (data.docs ?? []).map((doc) => ({
    key: doc.key,
    title: doc.title,
    author: doc.author_name?.join(', ') ?? '',
    isbn: doc.isbn?.[0],
    coverId: doc.cover_i,
  }))
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]'
const labelClass = 'mb-1 block text-xs font-semibold text-[var(--text-muted)]'

export function BookEditor(props: Props) {
  // The editor seeds once from `initial`, then owns its own state.
  const initial = props.initial
  const [title, setTitle] = createSignal(initial.title ?? '')
  const [author, setAuthor] = createSignal(initial.author ?? '')
  const [isbn, setIsbn] = createSignal(initial.isbn ?? '')
  // Debounced separately from `isbn` so the lookup doesn't fire on every keystroke.
  const [debouncedIsbn, updateDebouncedIsbn] = createDebounced(600, initial.isbn ?? '')
  // Starts blank (not `initial.title`) so opening the editor on an existing
  // book never fires a search on its own — only actually typing does.
  const [debouncedTitleQuery, updateDebouncedTitleQuery] = createDebounced(400, '')
  const [titleResultsOpen, setTitleResultsOpen] = createSignal(false)
  const [coverUrl, setCoverUrl] = createSignal(initial.cover_url ?? '')
  const [status, setStatus] = createSignal<BookStatus>(initial.status ?? 'WANT_TO_READ')
  const [rating, setRating] = createSignal<number | null>(initial.rating ?? null)
  const [review, setReview] = createSignal(initial.review ?? '')
  const [startedAt, setStartedAt] = createSignal(initial.started_at ?? '')
  const [finishedAt, setFinishedAt] = createSignal(initial.finished_at ?? '')
  const [isSaving, setIsSaving] = createSignal(false)
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [error, setError] = createSignal<unknown>(null)
  const id = createUniqueId()
  let reviewEl: HTMLTextAreaElement | undefined
  const { applyWrap: applyReviewWrap } = createEditorFormatting(() => reviewEl, setReview)

  onEscapeKey(() => props.onClose())

  function handleIsbnChange(value: string) {
    setIsbn(value)
    updateDebouncedIsbn(value)
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    setTitleResultsOpen(true)
    updateDebouncedTitleQuery(value)
  }

  // Title/author come straight from the search result; only the isbn (for
  // storage) or, failing that, the cover id (for a cover image) is needed.
  function selectTitleResult(result: TitleSearchResult) {
    setTitle(result.title)
    if (result.author) setAuthor(result.author)
    if (result.isbn) {
      setIsbn(result.isbn)
    } else if (result.coverId) {
      const coverId = result.coverId
      setCoverUrl((prev) => prev || getOpenLibraryCoverUrlById(coverId))
    }
    setTitleResultsOpen(false)
  }

  // ISBN lookup: fires once the (debounced) ISBN is lookup-able.
  const isbnLookup = createLookup<OpenLibraryBook | null>({
    key: () => {
      const clean = normalizeIsbn(debouncedIsbn())
      return isLookupableIsbn(clean) ? clean : null
    },
    fetcher: fetchIsbnLookup,
    hasResult: (book) => book != null,
  })

  // Title search: only while the results dropdown is open and the query is long enough.
  const titleSearch = createLookup<TitleSearchResult[]>({
    key: () => {
      const q = debouncedTitleQuery().trim()
      return titleResultsOpen() && q.length >= 2 ? q : null
    },
    fetcher: fetchTitleSearch,
    hasResult: (results) => results.length > 0,
  })
  const titleResults = () => titleSearch.data() ?? []

  // Autofill blank title/author once per ISBN lookup result.
  let lastAppliedBook: OpenLibraryBook | null | undefined
  const lookedUpBook = createMemo(() => isbnLookup.data())
  createMemo(() => {
    const book = lookedUpBook()
    if (!book || book === lastAppliedBook) return
    lastAppliedBook = book
    const foundTitle = book.title
    const authors = book.authors
    queueMicrotask(() => {
      if (foundTitle) setTitle((prev) => prev || foundTitle)
      if (authors?.length) setAuthor((prev) => prev || authors.map((a) => a.name).join(', '))
    })
  })

  async function save() {
    setIsSaving(true)
    setError(null)
    try {
      // Server-function args are JSON: omit empty keys rather than pass undefined.
      const input: UpsertBookInput = {
        ...(initial.id ? { id: initial.id } : {}),
        title: title(),
        author: author(),
        ...(normalizeIsbn(isbn()) ? { isbn: normalizeIsbn(isbn()) } : {}),
        ...(coverUrl() ? { cover_url: coverUrl() } : {}),
        status: status(),
        ...(rating() != null ? { rating: rating()! } : {}),
        ...(review() ? { review: review() } : {}),
        ...(startedAt() ? { started_at: startedAt() } : {}),
        ...(finishedAt() ? { finished_at: finishedAt() } : {}),
      }
      const book = await upsertBook(input)
      props.onSaved(book as DbBook)
    } catch (e) {
      setError(e)
    } finally {
      setIsSaving(false)
    }
  }

  async function remove() {
    if (!initial.id) return
    setIsDeleting(true)
    setError(null)
    try {
      await deleteBook(initial.id)
      props.onDeleted()
    } catch (e) {
      setError(e)
    } finally {
      setIsDeleting(false)
    }
  }

  const isBusy = () => isSaving() || isDeleting()

  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 backdrop-blur-sm sm:pt-16">
      <div
        data-testid="book-editor"
        class="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="m-0 text-lg font-semibold text-[var(--text)]">
            {initial.id ? 'Edit book' : 'Add book'}
          </h2>
          <button
            type="button"
            onClick={() => props.onClose()}
            data-testid="close-book-editor"
            aria-label="Close editor"
            class="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>

        <div class="flex gap-4">
          <CoverImage
            book={{ cover_url: coverUrl() || null, isbn: isbn() }}
            iconClass="text-2xl"
            class="h-28 w-20 flex-shrink-0 rounded-lg bg-[var(--chip-bg)]"
          />

          <div class="flex-1 space-y-2.5">
            <div class="relative">
              <label for={`${id}-title`} class={labelClass}>Title</label>
              <input
                id={`${id}-title`}
                type="text"
                value={title()}
                onInput={(e) => handleTitleChange(e.currentTarget.value)}
                onFocus={() => setTitleResultsOpen(true)}
                onBlur={() => setTitleResultsOpen(false)}
                autocomplete="off"
                data-testid="book-title-input"
                class={inputClass}
              />
              <Show when={titleSearch.status() === 'loading'}>
                <p class="mt-1 text-xs text-[var(--text-muted)]">Searching…</p>
              </Show>
              <Show when={titleSearch.status() === 'not-found'}>
                <p class="mt-1 text-xs text-[var(--text-muted)]">No matches for that title.</p>
              </Show>
              <Show when={titleSearch.status() === 'error'}>
                <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                  Couldn't search Open Library — check your connection and try again.
                </p>
              </Show>
              <Show when={titleResultsOpen() && titleResults().length > 0}>
                <ul
                  data-testid="title-search-results"
                  class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg"
                >
                  <For each={titleResults()}>
                    {(result) => (
                      <li>
                        <button
                          type="button"
                          data-testid={`title-search-result-${result.key}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectTitleResult(result)}
                          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--hover-bg)]"
                        >
                          <span class="min-w-0 flex-1">
                            <span class="block truncate font-medium text-[var(--text)]">
                              {result.title}
                            </span>
                            <Show when={result.author}>
                              <span class="block truncate text-xs text-[var(--text-muted)]">
                                {result.author}
                              </span>
                            </Show>
                          </span>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
            <div>
              <label for={`${id}-author`} class={labelClass}>Author</label>
              <input
                id={`${id}-author`}
                type="text"
                value={author()}
                onInput={(e) => setAuthor(e.currentTarget.value)}
                data-testid="book-author-input"
                class={inputClass}
              />
            </div>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label for={`${id}-isbn`} class={labelClass}>ISBN-10 or ISBN-13</label>
            <input
              id={`${id}-isbn`}
              type="text"
              value={isbn()}
              onInput={(e) => handleIsbnChange(e.currentTarget.value)}
              placeholder="978-0-000-00000-0"
              data-testid="book-isbn-input"
              class={inputClass}
            />
            <Show when={isbnLookup.status() === 'loading'}>
              <p class="mt-1 text-xs text-[var(--text-muted)]">Looking up…</p>
            </Show>
            <Show when={isbnLookup.status() === 'found'}>
              <p class="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Found — title/author filled in.
              </p>
            </Show>
            <Show when={isbnLookup.status() === 'not-found'}>
              <p class="mt-1 text-xs text-red-600 dark:text-red-400" data-testid="isbn-lookup-error">
                No book found for that ISBN.
              </p>
            </Show>
            <Show when={isbnLookup.status() === 'error'}>
              <p class="mt-1 text-xs text-red-600 dark:text-red-400" data-testid="isbn-lookup-error">
                Couldn't look up that ISBN — check your connection and try again.
              </p>
            </Show>
          </div>
          <div>
            <label for={`${id}-cover`} class={labelClass}>Cover URL override</label>
            <input
              id={`${id}-cover`}
              type="text"
              value={coverUrl()}
              onInput={(e) => setCoverUrl(e.currentTarget.value)}
              placeholder="https://…"
              data-testid="book-cover-input"
              class={inputClass}
            />
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-4">
          <div>
            <span class={labelClass}>Status</span>
            <div class="flex rounded-full border border-[var(--border)] bg-[var(--chip-bg)] p-0.5 text-xs">
              <For each={STATUS_OPTIONS}>
                {(opt) => (
                  <button
                    type="button"
                    data-testid={`book-status-${opt.value}`}
                    onClick={() => setStatus(opt.value)}
                    class={`rounded-full px-2.5 py-1 font-semibold transition ${
                      status() === opt.value
                        ? 'bg-[var(--blue-deep)] text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <div>
            <span class={labelClass}>Rating</span>
            <StarRating rating={rating()} onChange={setRating} size="md" />
          </div>
        </div>

        <Show when={status() !== 'WANT_TO_READ'}>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label for={`${id}-started`} class={labelClass}>Started</label>
              <input
                id={`${id}-started`}
                type="date"
                value={startedAt()}
                onInput={(e) => setStartedAt(e.currentTarget.value)}
                class={inputClass}
              />
            </div>
            <Show when={status() === 'READ'}>
              <div>
                <label for={`${id}-finished`} class={labelClass}>Finished</label>
                <input
                  id={`${id}-finished`}
                  type="date"
                  value={finishedAt()}
                  onInput={(e) => setFinishedAt(e.currentTarget.value)}
                  class={inputClass}
                />
              </div>
            </Show>
          </div>
        </Show>

        <div class="mt-3">
          <div class="mb-1 flex items-center justify-between">
            <label for={`${id}-review`} class="block text-xs font-semibold text-[var(--text-muted)]">
              Review / notes
            </label>
            <ToolbarButton
              label="Insert spoiler"
              title="Mark selection as a spoiler (wrap with ||)"
              onAction={() => applyReviewWrap('||', '||', 'spoiler text')}
            />
          </div>
          <textarea
            ref={reviewEl}
            id={`${id}-review`}
            value={review()}
            onInput={(e) => setReview(e.currentTarget.value)}
            rows={10}
            data-testid="book-review-input"
            class="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
          />
          <Show when={review()}>
            <div class="mt-2 rounded-lg border border-[var(--border)] bg-[var(--chip-bg)] px-3 py-2">
              <p class="mb-1 text-xs font-semibold text-[var(--text-muted)]">Preview</p>
              <p
                data-testid="book-review-preview"
                class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]"
              >
                <ReviewText text={review()} />
              </p>
            </div>
          </Show>
        </div>

        <Show when={error()}>
          <p class="mt-3 text-sm text-red-600 dark:text-red-400">
            {error() instanceof Error ? (error() as Error).message : 'Something went wrong'}
          </p>
        </Show>

        <div class="mt-4 flex items-center justify-between">
          <Show when={initial.id} fallback={<span />}>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${title()}"? This can't be undone.`)) remove()
              }}
              disabled={isBusy()}
              class="rounded-full border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
            >
              Delete
            </button>
          </Show>

          <button
            type="button"
            onClick={save}
            data-testid="book-save"
            disabled={isBusy() || !title() || !author()}
            class="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isSaving() ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
