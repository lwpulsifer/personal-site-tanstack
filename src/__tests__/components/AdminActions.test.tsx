import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { DbBook } from '#/server/books'
import { AdminActions } from '#/components/books/AdminActions'
import { describe, expect, it } from 'vitest'

const baseBook: DbBook = {
  id: '1',
  title: 'Project Hail Mary',
  author: 'Andy Weir',
  isbn: null,
  cover_url: null,
  status: 'WANT_TO_READ',
  rating: null,
  review: null,
  started_at: null,
  finished_at: null,
  created_at: '2026-04-01T12:00:00Z',
  updated_at: '2026-04-01T12:00:00Z',
}

const noop = () => {}

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('AdminActions', () => {
  it('shows a quick status action for WANT_TO_READ', () => {
    withQueryClient(<AdminActions book={baseBook} onEdit={noop} />)
    expect(screen.getByTestId('book-next-status').textContent).toBe('Start reading')
  })

  it('shows a quick status action for READING', () => {
    const readingBook = { ...baseBook, status: 'READING' as const }
    withQueryClient(<AdminActions book={readingBook} onEdit={noop} />)
    expect(screen.getByTestId('book-next-status').textContent).toBe('Mark read')
  })

  it('hides the quick status action for READ — an end state you must edit into', () => {
    const readBook = { ...baseBook, status: 'READ' as const }
    withQueryClient(<AdminActions book={readBook} onEdit={noop} />)
    expect(screen.queryByTestId('book-next-status')).toBeNull()
    // Edit and Delete are still there.
    expect(screen.getByTestId('book-edit')).toBeTruthy()
    expect(screen.getByTestId('book-delete')).toBeTruthy()
  })
})
