import { describe, expect, it } from 'vitest'
import type { DbBook } from '#/server/books'
import { groupBooks } from '#/routes/books.index'

function makeBook(overrides: Partial<DbBook> = {}): DbBook {
  return {
    id: overrides.id ?? '1',
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    isbn: null,
    cover_url: null,
    status: 'READ',
    rating: null,
    review: null,
    started_at: null,
    finished_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('groupBooks', () => {
  it('orders the Read shelf by finished_at, not started_at', () => {
    // Started long ago, finished most recently: should sort first.
    const slowBurn = makeBook({
      id: 'slow-burn',
      started_at: '2025-01-01',
      finished_at: '2026-06-01',
    })
    // Started recently, finished a while back: should sort after.
    const quickRead = makeBook({
      id: 'quick-read',
      started_at: '2026-05-01',
      finished_at: '2026-02-01',
    })

    const { read } = groupBooks([quickRead, slowBurn])

    expect(read.map((b) => b.id)).toEqual(['slow-burn', 'quick-read'])
  })

  it('orders the Reading shelf by started_at', () => {
    const olderStart = makeBook({
      id: 'older',
      status: 'READING',
      started_at: '2026-01-01',
    })
    const newerStart = makeBook({
      id: 'newer',
      status: 'READING',
      started_at: '2026-06-01',
    })

    const { reading } = groupBooks([olderStart, newerStart])

    expect(reading.map((b) => b.id)).toEqual(['newer', 'older'])
  })

  it('orders the Want to Read shelf by created_at', () => {
    const older = makeBook({
      id: 'older',
      status: 'WANT_TO_READ',
      created_at: '2026-01-01',
    })
    const newer = makeBook({
      id: 'newer',
      status: 'WANT_TO_READ',
      created_at: '2026-06-01',
    })

    const { wantToRead } = groupBooks([older, newer])

    expect(wantToRead.map((b) => b.id)).toEqual(['newer', 'older'])
  })
})
