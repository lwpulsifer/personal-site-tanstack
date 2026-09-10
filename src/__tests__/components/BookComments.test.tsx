import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookComment } from '#/server/comments'

vi.mock('#/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('#/server/comments', () => ({
  getBookComments: vi.fn(),
  addComment: vi.fn(),
  approveComment: vi.fn(),
  rejectComment: vi.fn(),
}))

const { useAuth } = await import('#/lib/auth')
const { getBookComments, addComment } = await import('#/server/comments')
const { BookComments } = await import('#/components/books/BookComments')

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const pendingOwnComment: BookComment = {
  id: 'c-own',
  book_id: 'book-1',
  author_name: 'Jane',
  body: 'My own pending comment',
  status: 'pending',
  created_at: '2026-09-10T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  isOwn: true,
}

const pendingOtherComment: BookComment = {
  ...pendingOwnComment,
  id: 'c-other',
  author_name: 'Bob',
  body: 'Someone else pending',
  isOwn: false,
}

describe('BookComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ user: null, isAuthenticated: false })
  })

  it('submits a comment with an empty honeypot field', async () => {
    vi.mocked(getBookComments).mockResolvedValue([])
    vi.mocked(addComment).mockResolvedValue({
      ...pendingOwnComment,
      id: 'new-1',
    })

    const user = userEvent.setup()
    withQueryClient(<BookComments bookId="book-1" />)

    await user.type(screen.getByTestId('book-comment-name-input'), 'Jane')
    await user.type(
      screen.getByTestId('book-comment-body-input'),
      'Great book!',
    )
    await user.click(screen.getByTestId('book-comment-submit'))

    await waitFor(() => expect(addComment).toHaveBeenCalled())
    expect(addComment).toHaveBeenCalledWith({
      data: {
        bookId: 'book-1',
        authorName: 'Jane',
        body: 'Great book!',
        website: '',
      },
    })
  })

  it('keeps the honeypot field out of view', () => {
    vi.mocked(getBookComments).mockResolvedValue([])
    withQueryClient(<BookComments bookId="book-1" />)

    const honeypot = document.querySelector('input[aria-hidden="true"]')
    expect(honeypot).toBeTruthy()
    expect(honeypot).toHaveProperty('tabIndex', -1)
  })

  it('hides Approve/Reject controls from non-admin viewers', async () => {
    vi.mocked(getBookComments).mockResolvedValue([pendingOtherComment])
    withQueryClient(<BookComments bookId="book-1" />)

    await screen.findByTestId('book-comment-item-c-other')
    expect(screen.queryByTestId('book-comment-approve-c-other')).toBeNull()
    expect(screen.queryByTestId('book-comment-reject-c-other')).toBeNull()
  })

  it('shows Approve/Reject for pending comments when the viewer is an admin', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'admin-1' } as never,
      isAuthenticated: true,
    })
    vi.mocked(getBookComments).mockResolvedValue([pendingOtherComment])
    withQueryClient(<BookComments bookId="book-1" />)

    await screen.findByTestId('book-comment-approve-c-other')
    expect(screen.getByTestId('book-comment-reject-c-other')).toBeTruthy()
  })

  it("labels a visitor's own pending comment as awaiting approval", async () => {
    vi.mocked(getBookComments).mockResolvedValue([pendingOwnComment])
    withQueryClient(<BookComments bookId="book-1" />)

    await screen.findByTestId('book-comment-item-c-own')
    expect(screen.getByText(/awaiting approval/i)).toBeTruthy()
  })
})
