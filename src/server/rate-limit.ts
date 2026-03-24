const WINDOW_MS = 60_000
const MAX_REQUESTS = 5

const store = new Map<string, number[]>()

export function checkRateLimit(key: string): { allowed: boolean } {
  const now = Date.now()
  const timestamps = (store.get(key) ?? []).filter((t) => t > now - WINDOW_MS)
  if (timestamps.length >= MAX_REQUESTS) {
    store.set(key, timestamps)
    return { allowed: false }
  }
  timestamps.push(now)
  store.set(key, timestamps)
  return { allowed: true }
}

/** Reset all state — only for tests. */
export function _resetRateLimitStore(): void {
  store.clear()
}
