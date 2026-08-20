import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { CoverImage } from '#/components/books/CoverImage'
import { StarRating } from '#/components/books/StarRating'
import { useOnEscapeKey } from '#/lib/hooks/useOnEscapeKey'
import { isLookupableIsbn, normalizeIsbn } from '#/lib/openLibrary'
import {
  type BookStatus,
  type DbBook,
  deleteBook,
  upsertBook,
} from '#/server/books'

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

function openLibraryCoverById(coverId: number) {
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
}

type IsbnLookupStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error'

type OpenLibraryBook = { title?: string; authors?: { name: string }[] }

async function fetchIsbnLookup(
  cleanIsbn: string,
  signal: AbortSignal,
): Promise<OpenLibraryBook | null> {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&jscmd=data&format=json`,
    { signal },
  )
  if (!res.ok) throw new Error('Lookup request failed')
  const data = (await res.json()) as Record<string, OpenLibraryBook>
  return data[`ISBN:${cleanIsbn}`] ?? null
}

function deriveIsbnStatus(
  lookupEnabled: boolean,
  query: Pick<
    ReturnType<typeof useQuery<OpenLibraryBook | null>>,
    'isFetching' | 'isError' | 'isSuccess' | 'data'
  >,
): IsbnLookupStatus {
  if (!lookupEnabled) return 'idle'
  if (query.isFetching) return 'loading'
  if (query.isError) return 'error'
  if (query.data) return 'found'
  if (query.isSuccess) return 'not-found'
  return 'idle'
}

type TitleSearchResult = {
  key: string
  title: string
  author: string
  isbn?: string
  coverId?: number
}

type TitleSearchStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error'

async function fetchTitleSearch(
  query: string,
  signal: AbortSignal,
): Promise<TitleSearchResult[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&fields=key,title,author_name,isbn,cover_i&limit=5`,
    { signal },
  )
  if (!res.ok) throw new Error('Search request failed')
  const data = (await res.json()) as {
    docs?: {
      key: string
      title: string
      author_name?: string[]
      isbn?: string[]
      cover_i?: number
    }[]
  }
  return (data.docs ?? []).map((doc) => ({
    key: doc.key,
    title: doc.title,
    author: doc.author_name?.join(', ') ?? '',
    isbn: doc.isbn?.[0],
    coverId: doc.cover_i,
  }))
}

function deriveTitleSearchStatus(
  searchEnabled: boolean,
  query: Pick<
    ReturnType<typeof useQuery<TitleSearchResult[]>>,
    'isFetching' | 'isError' | 'isSuccess' | 'data'
  >,
): TitleSearchStatus {
  if (!searchEnabled) return 'idle'
  if (query.isFetching) return 'loading'
  if (query.isError) return 'error'
  if (query.data?.length) return 'found'
  if (query.isSuccess) return 'not-found'
  return 'idle'
}

export function BookEditor({ initial, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [author, setAuthor] = useState(initial.author ?? '')
  const [isbn, setIsbn] = useState(initial.isbn ?? '')
  // Debounced separately from `isbn` so the lookup query doesn't fire on
  // every keystroke — updated from the input's onChange handler itself
  // rather than an effect reacting to `isbn`.
  const [debouncedIsbn, setDebouncedIsbn] = useState(initial.isbn ?? '')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  // Starts blank (not `initial.title`) so opening the editor on an existing
  // book never fires a search on its own — only actually typing does.
  const [debouncedTitleQuery, setDebouncedTitleQuery] = useState('')
  const titleDebounceTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined)
  const [titleResultsOpen, setTitleResultsOpen] = useState(false)
  const [coverUrl, setCoverUrl] = useState(initial.cover_url ?? '')
  const [status, setStatus] = useState<BookStatus>(
    initial.status ?? 'WANT_TO_READ',
  )
  const [rating, setRating] = useState<number | null>(initial.rating ?? null)
  const [review, setReview] = useState(initial.review ?? '')
  const [startedAt, setStartedAt] = useState(initial.started_at ?? '')
  const [finishedAt, setFinishedAt] = useState(initial.finished_at ?? '')
  const id = useId()

  useOnEscapeKey(onClose)

  function handleIsbnChange(value: string) {
    setIsbn(value)
    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => setDebouncedIsbn(value), 600)
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    setTitleResultsOpen(true)
    clearTimeout(titleDebounceTimerRef.current)
    titleDebounceTimerRef.current = setTimeout(
      () => setDebouncedTitleQuery(value),
      400,
    )
  }

  function selectTitleResult(result: TitleSearchResult) {
    setTitle(result.title)
    if (result.author) setAuthor(result.author)
    if (result.isbn) {
      setIsbn(result.isbn)
      setDebouncedIsbn(result.isbn)
    } else if (result.coverId) {
      const coverId = result.coverId
      setCoverUrl((prev) => prev || openLibraryCoverById(coverId))
    }
    setTitleResultsOpen(false)
  }

  const cleanIsbn = normalizeIsbn(debouncedIsbn)
  const lookupEnabled = isLookupableIsbn(cleanIsbn)
  const isbnLookupQuery = useQuery({
    queryKey: ['isbnLookup', cleanIsbn],
    queryFn: ({ signal }) => fetchIsbnLookup(cleanIsbn, signal),
    enabled: lookupEnabled,
    retry: false,
  })
  const lookedUpBook = isbnLookupQuery.data
  const isbnStatus = deriveIsbnStatus(lookupEnabled, isbnLookupQuery)

  const trimmedTitleQuery = debouncedTitleQuery.trim()
  const titleSearchEnabled = titleResultsOpen && trimmedTitleQuery.length >= 2
  const titleSearchQuery = useQuery({
    queryKey: ['titleSearch', trimmedTitleQuery],
    queryFn: ({ signal }) => fetchTitleSearch(trimmedTitleQuery, signal),
    enabled: titleSearchEnabled,
    retry: false,
  })
  const titleSearchStatus = deriveTitleSearchStatus(
    titleSearchEnabled,
    titleSearchQuery,
  )
  const titleResults = titleSearchQuery.data ?? []

  // Autofill blank title/author fields once per lookup result. Comparing
  // against the last-applied result and calling setState during render
  // (React's supported "adjust state when a value changes" pattern) keeps
  // this a plain render-time sync instead of an effect.
  const [lastAppliedBook, setLastAppliedBook] = useState<
    OpenLibraryBook | null | undefined
  >(undefined)
  if (lookedUpBook && lookedUpBook !== lastAppliedBook) {
    setLastAppliedBook(lookedUpBook)
    const foundTitle = lookedUpBook.title
    const authors = lookedUpBook.authors
    if (foundTitle) setTitle((prev) => prev || foundTitle)
    if (authors?.length) {
      const names = authors.map((a) => a.name).join(', ')
      setAuthor((prev) => prev || names)
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertBook({
        data: {
          ...(initial.id ? { id: initial.id } : {}),
          title,
          author,
          isbn: normalizeIsbn(isbn) || undefined,
          cover_url: coverUrl || undefined,
          status,
          rating: rating ?? undefined,
          review: review || undefined,
          started_at: startedAt || undefined,
          finished_at: finishedAt || undefined,
        },
      }),
    onSuccess: (book) => onSaved(book),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!initial.id) throw new Error('Book not saved yet')
      return deleteBook({ data: { bookId: initial.id } })
    },
    onSuccess: onDeleted,
  })

  const error = saveMutation.error ?? deleteMutation.error
  const isBusy = saveMutation.isPending || deleteMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 backdrop-blur-sm sm:pt-16">
      <div
        data-testid="book-editor"
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-lg font-semibold text-[var(--text)]">
            {initial.id ? 'Edit book' : 'Add book'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-book-editor"
            aria-label="Close editor"
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-4">
          <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--chip-bg)]">
            <CoverImage
              src={coverUrl || null}
              isbn={isbn}
              iconClassName="text-2xl"
            />
          </div>

          <div className="flex-1 space-y-2.5">
            <div className="relative">
              <label
                htmlFor={`${id}-title`}
                className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
              >
                Title
              </label>
              <input
                id={`${id}-title`}
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onFocus={() => setTitleResultsOpen(true)}
                onBlur={() => setTitleResultsOpen(false)}
                autoComplete="off"
                data-testid="book-title-input"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
              />
              {titleSearchStatus === 'loading' && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Searching…
                </p>
              )}
              {titleSearchStatus === 'not-found' && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  No matches for that title.
                </p>
              )}
              {titleSearchStatus === 'error' && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Couldn't search Open Library — check your connection and try
                  again.
                </p>
              )}
              {titleResultsOpen && titleResults.length > 0 && (
                <ul
                  data-testid="title-search-results"
                  className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg"
                >
                  {titleResults.map((result) => (
                    <li key={result.key}>
                      <button
                        type="button"
                        data-testid={`title-search-result-${result.key}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectTitleResult(result)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--hover-bg)]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-[var(--text)]">
                            {result.title}
                          </span>
                          {result.author && (
                            <span className="block truncate text-xs text-[var(--text-muted)]">
                              {result.author}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label
                htmlFor={`${id}-author`}
                className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
              >
                Author
              </label>
              <input
                id={`${id}-author`}
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                data-testid="book-author-input"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${id}-isbn`}
              className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
            >
              ISBN-10 or ISBN-13
            </label>
            <input
              id={`${id}-isbn`}
              type="text"
              value={isbn}
              onChange={(e) => handleIsbnChange(e.target.value)}
              placeholder="978-0-000-00000-0"
              data-testid="book-isbn-input"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
            {isbnStatus === 'loading' && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Looking up…
              </p>
            )}
            {isbnStatus === 'found' && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Found — title/author filled in.
              </p>
            )}
            {isbnStatus === 'not-found' && (
              <p
                className="mt-1 text-xs text-red-600 dark:text-red-400"
                data-testid="isbn-lookup-error"
              >
                No book found for that ISBN.
              </p>
            )}
            {isbnStatus === 'error' && (
              <p
                className="mt-1 text-xs text-red-600 dark:text-red-400"
                data-testid="isbn-lookup-error"
              >
                Couldn't look up that ISBN — check your connection and try
                again.
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor={`${id}-cover`}
              className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
            >
              Cover URL override
            </label>
            <input
              id={`${id}-cover`}
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div>
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Status
            </span>
            <div className="flex rounded-full border border-[var(--border)] bg-[var(--chip-bg)] p-0.5 text-xs">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`book-status-${opt.value}`}
                  onClick={() => setStatus(opt.value)}
                  className={`rounded-full px-2.5 py-1 font-semibold transition ${
                    status === opt.value
                      ? 'bg-[var(--blue-deep)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Rating
            </span>
            <StarRating rating={rating} onChange={setRating} size="md" />
          </div>
        </div>

        {status !== 'WANT_TO_READ' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${id}-started`}
                className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
              >
                Started
              </label>
              <input
                id={`${id}-started`}
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
              />
            </div>
            {status === 'READ' && (
              <div>
                <label
                  htmlFor={`${id}-finished`}
                  className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
                >
                  Finished
                </label>
                <input
                  id={`${id}-finished`}
                  type="date"
                  value={finishedAt}
                  onChange={(e) => setFinishedAt(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-3">
          <label
            htmlFor={`${id}-review`}
            className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
          >
            Review / notes
          </label>
          <textarea
            id={`${id}-review`}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={4}
            data-testid="book-review-input"
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Something went wrong'}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          {initial.id ? (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${title}"? This can't be undone.`)) {
                  deleteMutation.mutate()
                }
              }}
              disabled={isBusy}
              className="rounded-full border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
            >
              Delete
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            data-testid="book-save"
            disabled={isBusy || !title || !author}
            className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
