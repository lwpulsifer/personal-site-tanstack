import type { BookStatus } from '#/server/books'

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
