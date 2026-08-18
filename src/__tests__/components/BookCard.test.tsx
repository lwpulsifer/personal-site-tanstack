import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { DbBook } from '#/server/books'
import { BookCard } from '#/components/books/BookCard'
import { describe, expect, it } from 'vitest'

const baseBook: DbBook = {
  id: '1',
  title: 'Project Hail Mary',
  author: 'Andy Weir',
  isbn: '9780593135204',
  cover_url: null,
  status: 'READ',
  rating: 5,
  review: 'Loved it.',
  // Use midday UTC to avoid local-timezone day-boundary shifts in assertions.
  started_at: '2026-05-01',
  finished_at: '2026-05-15',
  created_at: '2026-04-01T12:00:00Z',
  updated_at: '2026-05-15T12:00:00Z',
}

const noop = () => {}

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('BookCard', () => {
  it('shows the title, author, and status', () => {
    render(<BookCard book={baseBook} showAdmin={false} onEdit={noop} />)
    expect(screen.getByText('Project Hail Mary')).toBeTruthy()
    expect(screen.getByText('Andy Weir')).toBeTruthy()
    expect(screen.getByText('Read')).toBeTruthy()
  })

  it('shows a star rating when rated', () => {
    render(<BookCard book={baseBook} showAdmin={false} onEdit={noop} />)
    expect(screen.getByRole('img', { name: 'Rated 5 out of 5' })).toBeTruthy()
  })

  it('hides the star rating when unrated', () => {
    const unrated = { ...baseBook, rating: null }
    render(<BookCard book={unrated} showAdmin={false} onEdit={noop} />)
    expect(screen.queryByRole('img', { name: /Rated/ })).toBeNull()
  })

  it('shows the cover image when one is provided', () => {
    const withCover = { ...baseBook, cover_url: 'https://example.com/cover.jpg' }
    const { container } = render(<BookCard book={withCover} showAdmin={false} onEdit={noop} />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg')
  })

  it('shows admin actions when showAdmin is true', () => {
    withQueryClient(<BookCard book={baseBook} showAdmin onEdit={noop} />)
    expect(screen.getByTestId('book-edit')).toBeTruthy()
    expect(screen.getByTestId('book-delete')).toBeTruthy()
  })

  it('hides admin actions when showAdmin is false', () => {
    render(<BookCard book={baseBook} showAdmin={false} onEdit={noop} />)
    expect(screen.queryByTestId('book-edit')).toBeNull()
  })
})
