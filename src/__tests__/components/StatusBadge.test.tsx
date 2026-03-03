import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '#/components/blog/StatusBadge'
import type { PostStatus } from '#/server/posts'

describe('StatusBadge', () => {
  const statuses: PostStatus[] = ['PUBLISHED', 'PENDING', 'ARCHIVED']

  for (const status of statuses) {
    it(`renders the ${status} label`, () => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(status)).toBeTruthy()
    })
  }
})
