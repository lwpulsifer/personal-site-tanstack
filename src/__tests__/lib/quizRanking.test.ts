import { describe, expect, it } from 'vitest'
import {
  aggregateOrderings,
  answer,
  initRanking,
  isDone,
  maxComparisons,
  nextPair,
  type RankingState,
  shuffle,
} from '#/lib/quizRanking'

/** Drive the ranking with a hidden "true" preference order. */
function runWithPreference(items: string[], preference: string[]) {
  let state: RankingState = initRanking(items)
  let steps = 0
  while (!isDone(state)) {
    const pair = nextPair(state)
    if (!pair) throw new Error('expected a pair')
    const [a, b] = pair
    state = answer(state, preference.indexOf(a) < preference.indexOf(b) ? a : b)
    steps++
    if (steps > 1000) throw new Error('did not terminate')
  }
  return { state, steps }
}

describe('quizRanking', () => {
  it('handles empty and single-item quizzes with no comparisons', () => {
    expect(isDone(initRanking([]))).toBe(true)
    const one = initRanking(['a'])
    expect(isDone(one)).toBe(true)
    expect(one.sorted).toEqual(['a'])
  })

  it('needs exactly one comparison for two items', () => {
    const { state, steps } = runWithPreference(['a', 'b'], ['b', 'a'])
    expect(steps).toBe(1)
    expect(state.sorted).toEqual(['b', 'a'])
  })

  it('recovers the true preference order for many permutations', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    let seed = 1
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let trial = 0; trial < 50; trial++) {
      const preference = shuffle(items, random)
      const order = shuffle(items, random)
      const { state, steps } = runWithPreference(order, preference)
      expect(state.sorted).toEqual(preference)
      expect(steps).toBeLessThanOrEqual(maxComparisons(items.length))
      expect(state.comparisons).toHaveLength(steps)
    }
  })

  it('never asks the same pair twice', () => {
    const items = Array.from({ length: 12 }, (_, i) => `i${i}`)
    let state = initRanking(items)
    const seen = new Set<string>()
    while (!isDone(state)) {
      const [a, b] = nextPair(state) as [string, string]
      const key = [a, b].sort().join('|')
      expect(seen.has(key)).toBe(false)
      seen.add(key)
      state = answer(state, a)
    }
    expect(state.sorted).toHaveLength(12)
  })

  it('rejects a winner outside the current pair', () => {
    const state = initRanking(['a', 'b', 'c'])
    expect(() => answer(state, 'zzz')).toThrow()
  })

  it('aggregates orderings by average rank', () => {
    const result = aggregateOrderings([
      ['a', 'b', 'c'],
      ['b', 'a', 'c'],
      ['a', 'c', 'b'],
    ])
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(result[0].averageRank).toBeCloseTo(4 / 3)
  })
})
