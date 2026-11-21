/**
 * Interactive binary-insertion sort over a set of item ids.
 *
 * The visitor answers one head-to-head comparison at a time; each answer
 * narrows where the item currently being inserted belongs in the already-
 * ranked list. Once every item has been inserted we have a total ordering,
 * after roughly sum(ceil(log2(k+1))) comparisons for k = 1..n-1 (e.g. ~25
 * for 10 items) — never asking a pair whose answer is already implied.
 *
 * The state is plain JSON so it can be persisted (localStorage) and undone
 * (keep a stack of previous states).
 */

export type Comparison = { winner: string; loser: string }

export type RankingState = {
  /** Ranked so far, most preferred first. */
  sorted: string[]
  /** Not yet inserted. */
  pending: string[]
  /** Item currently being inserted, or null when done. */
  current: string | null
  /** Insertion window into `sorted` for `current`: [lo, hi]. */
  lo: number
  hi: number
  comparisons: Comparison[]
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function advance(
  sorted: string[],
  pending: string[],
  comparisons: Comparison[],
): RankingState {
  const [current = null, ...rest] = pending
  return {
    sorted,
    pending: rest,
    current,
    lo: 0,
    hi: sorted.length,
    comparisons,
  }
}

export function initRanking(itemIds: readonly string[]): RankingState {
  const [first, ...rest] = itemIds
  if (first === undefined) return advance([], [], [])
  return advance([first], rest, [])
}

export function isDone(state: RankingState): boolean {
  return state.current === null
}

/** The pair to ask about next: [item being inserted, item it's compared to]. */
export function nextPair(state: RankingState): [string, string] | null {
  if (state.current === null) return null
  const mid = Math.floor((state.lo + state.hi) / 2)
  return [state.current, state.sorted[mid]]
}

/** Apply the visitor's pick. `winnerId` must be one of `nextPair(state)`. */
export function answer(state: RankingState, winnerId: string): RankingState {
  const pair = nextPair(state)
  if (!pair) return state
  const [current, other] = pair
  if (winnerId !== current && winnerId !== other) {
    throw new Error('Winner must be one of the current pair')
  }
  const mid = Math.floor((state.lo + state.hi) / 2)
  const currentWins = winnerId === current
  const comparisons = [
    ...state.comparisons,
    currentWins
      ? { winner: current, loser: other }
      : { winner: other, loser: current },
  ]
  // Higher preference = lower index.
  const lo = currentWins ? state.lo : mid + 1
  const hi = currentWins ? mid : state.hi

  if (lo < hi) return { ...state, lo, hi, comparisons }

  const sorted = [...state.sorted]
  sorted.splice(lo, 0, current)
  return advance(sorted, state.pending, comparisons)
}

/** Upper bound on comparisons for n items (for a progress bar). */
export function maxComparisons(n: number): number {
  let total = 0
  for (let k = 1; k < n; k++) total += Math.ceil(Math.log2(k + 1))
  return total
}

/**
 * Combine several orderings into one by average rank (lower = better).
 * Ids missing from a given ordering are ignored for that ordering.
 */
export function aggregateOrderings(
  orderings: readonly (readonly string[])[],
): { id: string; averageRank: number; count: number }[] {
  const totals = new Map<string, { sum: number; count: number }>()
  for (const ordering of orderings) {
    ordering.forEach((id, index) => {
      const t = totals.get(id) ?? { sum: 0, count: 0 }
      t.sum += index + 1
      t.count += 1
      totals.set(id, t)
    })
  }
  return [...totals.entries()]
    .map(([id, { sum, count }]) => ({ id, averageRank: sum / count, count }))
    .sort((a, b) => a.averageRank - b.averageRank)
}
