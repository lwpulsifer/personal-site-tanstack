import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DbBook } from '#/server/books'
import { BookCard } from '#/components/books/BookCard'
import { describe, expect, it, vi } from 'vitest'

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
    render(<BookCard book={baseBook} onView={() => {}} />)
    expect(screen.getByText('Project Hail Mary')).toBeTruthy()
    expect(screen.getByText('Andy Weir')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Rated 5 out of 5' })).toBeTruthy()
    // No status badge, review snippet, or dates on the cover tile.
    expect(screen.queryByText('Read')).toBeNull()
    expect(screen.queryByText('Loved it.')).toBeNull()
  })

  it('hides the star rating when unrated', () => {
    const unrated = { ...baseBook, rating: null }
    render(<BookCard book={unrated} onView={() => {}} />)
    expect(screen.queryByRole('img', { name: /Rated/ })).toBeNull()
  })

  it('shows the cover image when one is provided', () => {
    const withCover = { ...baseBook, cover_url: 'https://example.com/cover.jpg' }
    const { container } = render(<BookCard book={withCover} onView={() => {}} />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg')
  })

  it('calls onView when clicked', async () => {
    const onView = vi.fn()
    const user = userEvent.setup()
    render(<BookCard book={baseBook} onView={onView} />)
    await user.click(screen.getByTestId(`book-card-${baseBook.id}`))
    expect(onView).toHaveBeenCalledWith(baseBook)
  })
})
