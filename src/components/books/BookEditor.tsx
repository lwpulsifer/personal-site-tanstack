import { useEffect, useId, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { upsertBook, deleteBook, type BookStatus, type DbBook } from '#/server/books'
import { StarRating } from '#/components/books/StarRating'
import { useOnEscapeKey } from '#/lib/hooks/useOnEscapeKey'

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

function openLibraryCover(isbn: string) {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg`
}

// Strips whitespace/dashes so both "978-0-593-13520-4" and "9780593135204"
// resolve to the same lookup key.
function normalizeIsbn(raw: string) {
  return raw.replace(/[-\s]/g, '').toUpperCase()
}

// ISBN-10 (last check digit may be "X") or ISBN-13 — anything else isn't
// worth firing a lookup for yet.
function isLookupableIsbn(isbn: string) {
  return /^\d{9}[\dX]$/.test(isbn) || /^\d{13}$/.test(isbn)
}

type IsbnLookupStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error'

type OpenLibraryBook = { title?: string; authors?: { name: string }[] }

function useIsbnLookup(isbn: string) {
  const [status, setStatus] = useState<IsbnLookupStatus>('idle')
  const [book, setBook] = useState<OpenLibraryBook | null>(null)

  useEffect(() => {
    const cleanIsbn = normalizeIsbn(isbn)
    if (!isLookupableIsbn(cleanIsbn)) {
      setStatus('idle')
      return
    }

    const controller = new AbortController()
    setStatus('loading')
    const timeout = setTimeout(() => {
      fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&jscmd=data&format=json`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('Lookup request failed')
          return res.json() as Promise<Record<string, OpenLibraryBook>>
        })
        .then((data) => {
          const found = data[`ISBN:${cleanIsbn}`]
          if (!found) {
            setStatus('not-found')
            return
          }
          setStatus('found')
          setBook(found)
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setStatus('error')
        })
    }, 600)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [isbn])

  return { status, book }
}

export function BookEditor({ initial, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [author, setAuthor] = useState(initial.author ?? '')
  const [isbn, setIsbn] = useState(initial.isbn ?? '')
  const [coverUrl, setCoverUrl] = useState(initial.cover_url ?? '')
  const [status, setStatus] = useState<BookStatus>(initial.status ?? 'WANT_TO_READ')
  const [rating, setRating] = useState<number | null>(initial.rating ?? null)
  const [review, setReview] = useState(initial.review ?? '')
  const [startedAt, setStartedAt] = useState(initial.started_at ?? '')
  const [finishedAt, setFinishedAt] = useState(initial.finished_at ?? '')
  const id = useId()

  useOnEscapeKey(onClose)

  const { status: isbnStatus, book: lookedUpBook } = useIsbnLookup(isbn)

  useEffect(() => {
    if (!lookedUpBook) return
    if (lookedUpBook.title) setTitle((prev) => prev || (lookedUpBook.title as string))
    if (lookedUpBook.authors?.length) {
      const names = lookedUpBook.authors.map((a) => a.name).join(', ')
      setAuthor((prev) => prev || names)
    }
  }, [lookedUpBook])

  const coverPreview = useMemo(() => {
    if (coverUrl) return coverUrl
    const cleanIsbn = normalizeIsbn(isbn)
    return cleanIsbn ? openLibraryCover(cleanIsbn) : ''
  }, [coverUrl, isbn])

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
            {coverPreview ? (
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl opacity-40">📖</div>
            )}
          </div>

          <div className="flex-1 space-y-2.5">
            <div>
              <label htmlFor={`${id}-title`} className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
                Title
              </label>
              <input
                id={`${id}-title`}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="book-title-input"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
              />
            </div>
            <div>
              <label htmlFor={`${id}-author`} className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
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
            <label htmlFor={`${id}-isbn`} className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              ISBN-10 or ISBN-13
            </label>
            <input
              id={`${id}-isbn`}
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="978-0-000-00000-0"
              data-testid="book-isbn-input"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
            {isbnStatus === 'loading' && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">Looking up…</p>
            )}
            {isbnStatus === 'found' && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Found — title/author filled in.
              </p>
            )}
            {isbnStatus === 'not-found' && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400" data-testid="isbn-lookup-error">
                No book found for that ISBN.
              </p>
            )}
            {isbnStatus === 'error' && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400" data-testid="isbn-lookup-error">
                Couldn't look up that ISBN — check your connection and try again.
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-cover`} className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
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
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Status</span>
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
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Rating</span>
            <StarRating rating={rating} onChange={setRating} size="md" />
          </div>
        </div>

        {status !== 'WANT_TO_READ' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-started`} className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
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
                <label htmlFor={`${id}-finished`} className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
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
          <label htmlFor={`${id}-review`} className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
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
