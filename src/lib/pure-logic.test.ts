import { describe, expect, it } from 'vitest'
import { bfsDistances, buildSymmetricAdjacency, connectedComponents } from '../components/people/graphLayout'
import type { DbBook } from '../server/books'
import type { DbConnection } from '../server/people'
import { groupBooks } from './books'
import { connectionDisplayText } from './connectionKind'
import { nextMode } from './theme'

const book = (over: Partial<DbBook>): DbBook =>
  ({
    id: 'b',
    status: 'WANT_TO_READ',
    created_at: '2025-01-01T00:00:00Z',
    started_at: null,
    finished_at: null,
    ...over,
  }) as DbBook

const conn = (a: string, b: string, kind: DbConnection['kind'] = 'friend'): DbConnection =>
  ({ id: `${a}-${b}`, person_a_id: a, person_b_id: b, kind, label: null }) as DbConnection

describe('nextMode', () => {
  it('cycles light -> dark -> auto -> light', () => {
    expect(nextMode('light')).toBe('dark')
    expect(nextMode('dark')).toBe('auto')
    expect(nextMode('auto')).toBe('light')
  })
})

describe('groupBooks', () => {
  it('splits by status and orders each shelf by its own date, newest first', () => {
    const { reading, read, wantToRead } = groupBooks([
      book({ id: 'r1', status: 'READING', started_at: '2025-02-01' }),
      book({ id: 'r2', status: 'READING', started_at: '2025-03-01' }),
      book({ id: 'd1', status: 'READ', finished_at: '2025-01-10' }),
      book({ id: 'd2', status: 'READ', finished_at: '2025-04-10' }),
      book({ id: 'w1', created_at: '2025-05-01T00:00:00Z' }),
    ])
    expect(reading.map((b) => b.id)).toEqual(['r2', 'r1'])
    expect(read.map((b) => b.id)).toEqual(['d2', 'd1'])
    expect(wantToRead.map((b) => b.id)).toEqual(['w1'])
  })
})

describe('connectionDisplayText', () => {
  it('shows the kind alone, or with the trimmed comment', () => {
    expect(connectionDisplayText('partner', null)).toBe('Partner')
    expect(connectionDisplayText('partner', '  eloped 2019 ')).toBe('Partner (eloped 2019)')
  })
})

describe('graph layout helpers', () => {
  const connections = [conn('me', 'a'), conn('a', 'b'), conn('x', 'y')]

  it('computes hop distances from a start node', () => {
    const distances = bfsDistances(buildSymmetricAdjacency(connections), 'me')
    expect(distances.get('a')).toBe(1)
    expect(distances.get('b')).toBe(2)
    expect(distances.has('x')).toBe(false)
  })

  it('groups connected components, excluding the hub node', () => {
    const adjacency = buildSymmetricAdjacency(
      connections,
      (c) => c.person_a_id !== 'me' && c.person_b_id !== 'me',
    )
    const clusters = connectedComponents(['me', 'a', 'b', 'x', 'y'], adjacency, 'me')
    expect(clusters.has('me')).toBe(false)
    expect(clusters.get('a')).toBe(clusters.get('b'))
    expect(clusters.get('x')).toBe(clusters.get('y'))
    expect(clusters.get('a')).not.toBe(clusters.get('x'))
  })
})
