import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { DbPost } from '#/server/posts'
import { PostCard } from '#/components/blog/PostCard'
import { describe, expect, it, vi } from 'vitest'

// Link mock must render an <a> with href={to} — without href, the element
// won't have the ARIA "link" role and getByRole('link') queries will fail.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
  }) => <a href={to} className={className}>{children}</a>,
}))

const basePost: DbPost = {
  id: '1',
  slug: 'hello-world',
  title: 'Hello World',
  description: 'A test post',
  content: '# Hello',
  tags: ['typescript'],
  hero_image: null,
  // Use midday UTC to avoid local-timezone day-boundary shifts in assertions.
  published_at: '2025-06-15T12:00:00Z',
  created_at: '2025-06-15T12:00:00Z',
  updated_at: '2025-06-15T12:00:00Z',
  author_id: null,
  status: 'PUBLISHED',
}

const noop = () => {}

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('PostCard', () => {
  it('links to the post page when the post is published', () => {
    render(<PostCard post={basePost} showAdmin={false} onEdit={noop} />)
    expect(screen.getByRole('link', { name: 'Hello World' })).toBeTruthy()
  })

  it('does not link to the post page when the post is not published', () => {
    const pendingPost = { ...basePost, status: 'PENDING' as const }
    render(<PostCard post={pendingPost} showAdmin={false} onEdit={noop} />)
    expect(screen.queryByRole('link', { name: 'Hello World' })).toBeNull()
  })

  it('shows the hero image when one is provided', () => {
    const postWithImage = { ...basePost, hero_image: 'https://example.com/img.jpg' }
    const { container } = render(<PostCard post={postWithImage} showAdmin={false} onEdit={noop} />)
    // PostCard uses alt="" (decorative image), which gives role "presentation"
    // instead of "img" — so we use querySelector instead of getByRole('img').
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe('https://example.com/img.jpg')
  })

  it('hides the hero image in compact mode', () => {
    const postWithImage = { ...basePost, hero_image: 'https://example.com/img.jpg' }
    const { container } = render(
      <PostCard post={postWithImage} compact showAdmin={false} onEdit={noop} />,
    )
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows admin info when showAdmin is true', () => {
    withQueryClient(<PostCard post={basePost} showAdmin onEdit={noop} />)
    expect(screen.getByText('PUBLISHED')).toBeTruthy()
  })

  it('hides admin info when showAdmin is false', () => {
    render(<PostCard post={basePost} showAdmin={false} onEdit={noop} />)
    expect(screen.queryByText('PUBLISHED')).toBeNull()
  })
})
