import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookCard } from '#/components/books/BookCard'
import type { DbBook } from '#/server/books'

// Link mock must render an <a> with href={to} — without href, the element
// won't have the ARIA "link" role and getByRole('link') queries will fail.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
    'data-testid': dataTestId,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
    'data-testid'?: string
  }) => (
    <a
      href={to.replace(/\$(\w+)/, (_, key) => params?.[key] ?? '')}
      className={className}
      data-testid={dataTestId}
    >
      {children}
    </a>
  ),
}))

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

describe('BookCard', () => {
  it('shows the title, author, and rating — nothing else', () => {
    render(<BookCard book={baseBook} />)
    expect(screen.getByText('Project Hail Mary')).toBeTruthy()
    expect(screen.getByText('Andy Weir')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Rated 5 out of 5' })).toBeTruthy()
    // No status badge, review snippet, or dates on the cover tile.
    expect(screen.queryByText('Read')).toBeNull()
    expect(screen.queryByText('Loved it.')).toBeNull()
  })

  it('hides the star rating when unrated', () => {
    const unrated = { ...baseBook, rating: null }
    render(<BookCard book={unrated} />)
    expect(screen.queryByRole('img', { name: /Rated/ })).toBeNull()
  })

  it('shows the cover image when one is provided', () => {
    const withCover = {
      ...baseBook,
      cover_url: 'https://example.com/cover.jpg',
    }
    const { container } = render(<BookCard book={withCover} />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg')
  })

  it("links to the book's own page", () => {
    render(<BookCard book={baseBook} />)
    const link = screen.getByTestId(`book-card-${baseBook.id}`)
    expect(link.getAttribute('href')).toBe('/books/1')
  })
})
