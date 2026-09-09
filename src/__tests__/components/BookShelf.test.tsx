import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BookShelf } from '#/components/books/BookShelf'
import type { DbBook } from '#/server/books'

// BookShelf renders BookCard, which links to the book's own page — mocked
// the same way as BookCard's own test (see the comment there).
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

function makeBook(overrides: Partial<DbBook> = {}): DbBook {
  return {
    id: overrides.id ?? '1',
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
    ...overrides,
  }
}

describe('BookShelf', () => {
  it('renders nothing when there are no books', () => {
    const { container } = render(
      <BookShelf label="Reading" shelfKey="reading" books={[]} defaultOpen />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the grid immediately when defaultOpen is true', () => {
    const books = [makeBook()]
    render(
      <BookShelf
        label="Reading"
        shelfKey="reading"
        books={books}
        defaultOpen
      />,
    )
    expect(screen.getByTestId('shelf-books-reading')).toBeTruthy()
    expect(screen.queryByTestId('shelf-stack-reading')).toBeNull()
  })

  it('shows a collapsed stack when defaultOpen is false', () => {
    const books = [makeBook()]
    render(
      <BookShelf
        label="Want to Read"
        shelfKey="want_to_read"
        books={books}
        defaultOpen={false}
      />,
    )
    expect(screen.getByTestId('shelf-stack-want_to_read')).toBeTruthy()
    expect(screen.queryByTestId('shelf-books-want_to_read')).toBeNull()
  })

  it('expands the stack into the grid on click', async () => {
    const books = [makeBook()]
    const user = userEvent.setup()
    render(
      <BookShelf
        label="Want to Read"
        shelfKey="want_to_read"
        books={books}
        defaultOpen={false}
      />,
    )
    await user.click(screen.getByTestId('shelf-stack-want_to_read'))
    expect(screen.getByTestId('shelf-books-want_to_read')).toBeTruthy()
  })

  it('collapses back to a stack when the header toggle is clicked', async () => {
    const books = [makeBook()]
    const user = userEvent.setup()
    render(
      <BookShelf
        label="Reading"
        shelfKey="reading"
        books={books}
        defaultOpen
      />,
    )
    await user.click(screen.getByTestId('shelf-toggle-reading'))
    expect(screen.getByTestId('shelf-stack-reading')).toBeTruthy()
  })

  it('links each card in the expanded grid to its own book page', () => {
    const book = makeBook()
    render(
      <BookShelf
        label="Reading"
        shelfKey="reading"
        books={[book]}
        defaultOpen
      />,
    )
    const card = screen.getByTestId(`book-card-${book.id}`)
    expect(card.getAttribute('href')).toBe(`/books/${book.id}`)
  })
})
