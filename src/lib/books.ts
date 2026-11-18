import type { BookStatus, DbBook } from '../server/books'

function byDateDesc(dateA: string | null, dateB: string | null) {
  return new Date(dateB ?? 0).valueOf() - new Date(dateA ?? 0).valueOf()
}

export function groupBooks(books: DbBook[]) {
  const reading = books
    .filter((b) => b.status === 'READING')
    .sort((a, b) => byDateDesc(a.started_at, b.started_at))
  const read = books
    .filter((b) => b.status === 'READ')
    .sort((a, b) => byDateDesc(a.finished_at, b.finished_at))
  const wantToRead = books
    .filter((b) => b.status === 'WANT_TO_READ')
    .sort((a, b) => byDateDesc(a.created_at, b.created_at))
  return { reading, read, wantToRead }
}

export const STATUS_LABEL: Record<BookStatus, string> = {
  WANT_TO_READ: 'Want to Read',
  READING: 'Reading',
  READ: 'Read',
}

export const STATUS_STYLES: Record<BookStatus, string> = {
  READING: 'bg-[var(--blue-deep)]/10 text-[var(--blue-deep)] dark:text-blue-300',
  READ: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  WANT_TO_READ: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}
