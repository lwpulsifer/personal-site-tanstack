import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// createServerFn mock: a transparent builder where handler() returns the raw
// function, so BookEditor's imports resolve without hitting the network.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder: {
      inputValidator: (s: unknown) => typeof builder
      handler: (fn: unknown) => unknown
    } = {
      inputValidator: () => builder,
      handler: (fn) => fn,
    }
    return builder
  },
}))

const { BookEditor } = await import('#/components/books/BookEditor')

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const noop = () => {}

describe('BookEditor ISBN lookup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('looks up an ISBN-13 and fills in empty title/author fields', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        'ISBN:9780593135204': {
          title: 'Project Hail Mary',
          authors: [{ name: 'Andy Weir' }],
        },
      }),
    } as Response)

    const user = userEvent.setup()
    withQueryClient(
      <BookEditor
        initial={{}}
        onClose={noop}
        onSaved={noop}
        onDeleted={noop}
      />,
    )

    await user.type(screen.getByTestId('book-isbn-input'), '9780593135204')

    await waitFor(
      () =>
        expect(
          (screen.getByTestId('book-title-input') as HTMLInputElement).value,
        ).toBe('Project Hail Mary'),
      { timeout: 3000 },
    )
    expect(
      (screen.getByTestId('book-author-input') as HTMLInputElement).value,
    ).toBe('Andy Weir')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('ISBN:9780593135204'),
      expect.anything(),
    )
  })

  it('strips dashes before looking up an ISBN-10', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    const user = userEvent.setup()
    withQueryClient(
      <BookEditor
        initial={{}}
        onClose={noop}
        onSaved={noop}
        onDeleted={noop}
      />,
    )

    await user.type(screen.getByTestId('book-isbn-input'), '0-593-13520-4')

    await waitFor(() => expect(fetch).toHaveBeenCalled(), { timeout: 3000 })
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('ISBN:0593135204')
    expect(url).not.toContain('-')
  })

  it('shows an error message when the ISBN is not found', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    const user = userEvent.setup()
    withQueryClient(
      <BookEditor
        initial={{}}
        onClose={noop}
        onSaved={noop}
        onDeleted={noop}
      />,
    )

    await user.type(screen.getByTestId('book-isbn-input'), '9780593135204')

    await waitFor(
      () =>
        expect(screen.getByTestId('isbn-lookup-error').textContent).toContain(
          'No book found',
        ),
      { timeout: 3000 },
    )
  })

  it('shows an error message when the fetch itself fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))

    const user = userEvent.setup()
    withQueryClient(
      <BookEditor
        initial={{}}
        onClose={noop}
        onSaved={noop}
        onDeleted={noop}
      />,
    )

    await user.type(screen.getByTestId('book-isbn-input'), '9780593135204')

    await waitFor(
      () =>
        expect(screen.getByTestId('isbn-lookup-error').textContent).toContain(
          "Couldn't look up",
        ),
      { timeout: 3000 },
    )
  })

  it('does not overwrite a manually entered title', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        'ISBN:9780593135204': {
          title: 'Project Hail Mary',
          authors: [{ name: 'Andy Weir' }],
        },
      }),
    } as Response)

    const user = userEvent.setup()
    withQueryClient(
      <BookEditor
        initial={{}}
        onClose={noop}
        onSaved={noop}
        onDeleted={noop}
      />,
    )

    await user.type(screen.getByTestId('book-title-input'), 'My Custom Title')
    await user.type(screen.getByTestId('book-isbn-input'), '9780593135204')

    await waitFor(
      () =>
        expect(
          (screen.getByTestId('book-author-input') as HTMLInputElement).value,
        ).toBe('Andy Weir'),
      { timeout: 3000 },
    )
    expect(
      (screen.getByTestId('book-title-input') as HTMLInputElement).value,
    ).toBe('My Custom Title')
  })
})

describe('BookEditor title search', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('searches Open Library by title and fills in the selected result', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        docs: [
          {
            key: '/works/OL1W',
            title: 'Project Hail Mary',
            author_name: ['Andy Weir'],
            isbn: ['9780593135204'],
            cover_i: 12345,
          },
        ],
      }),
    } as Response)

    const user = userEvent.setup()
    withQueryClient(
      <BookEditor
        initial={{}}
        onClose={noop}
        onSaved={noop}
        onDeleted={noop}
      />,
    )

    await user.type(screen.getByTestId('book-title-input'), 'Project Hail')

    await waitFor(
      () =>
        expect(
          screen.getByTestId('title-search-result-/works/OL1W'),
        ).toBeTruthy(),
      { timeout: 3000 },
    )
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('title=Project%20Hail'),
      expect.anything(),
    )

    await user.click(screen.getByTestId('title-search-result-/works/OL1W'))

    expect(
      (screen.getByTestId('book-title-input') as HTMLInputElement).value,
    ).toBe('Project Hail Mary')
    expect(
      (screen.getByTestId('book-author-input') as HTMLInputElement).value,
    ).toBe('Andy Weir')
    expect(
      (screen.getByTestId('book-isbn-input') as HTMLInputElement).value,
    ).toBe('9780593135204')
    expect(screen.queryByTestId('title-search-results')).toBeNull()
  })

  it('shows a message when no titles match', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ docs: [] }),
    } as Response)

    const user = userEvent.setup()
    withQueryClient(
      <BookEditor
        initial={{}}
        onClose={noop}
        onSaved={noop}
        onDeleted={noop}
      />,
    )

    await user.type(screen.getByTestId('book-title-input'), 'Zzzznonexistent')

    await waitFor(
      () => expect(screen.getByText('No matches for that title.')).toBeTruthy(),
      { timeout: 3000 },
    )
  })

  it('shows an error message when the title search request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))

    const user = userEvent.setup()
    withQueryClient(
      <BookEditor
        initial={{}}
        onClose={noop}
        onSaved={noop}
        onDeleted={noop}
      />,
    )

    await user.type(screen.getByTestId('book-title-input'), 'Project Hail')

    await waitFor(
      () =>
        expect(
          screen.getByText(/Couldn't search Open Library/).textContent,
        ).toContain("Couldn't search Open Library"),
      { timeout: 3000 },
    )
  })
})
