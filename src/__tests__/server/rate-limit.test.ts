import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, _resetRateLimitStore } from '#/server/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetRateLimitStore()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows up to 5 requests in a window', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('ip-1').allowed).toBe(true)
    }
    expect(checkRateLimit('ip-1').allowed).toBe(false)
  })

  it('tracks keys independently', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('ip-a')
    expect(checkRateLimit('ip-a').allowed).toBe(false)
    expect(checkRateLimit('ip-b').allowed).toBe(true)
  })

  it('allows requests again after window expires', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('ip-1')
    expect(checkRateLimit('ip-1').allowed).toBe(false)

    vi.advanceTimersByTime(60_001)
    expect(checkRateLimit('ip-1').allowed).toBe(true)
  })

  it('partially expires old timestamps within the window', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('ip-1')
    vi.advanceTimersByTime(30_000)
    for (let i = 0; i < 2; i++) checkRateLimit('ip-1')
    // 5 total, but only 2 within the last 30s — should block
    expect(checkRateLimit('ip-1').allowed).toBe(false)

    // Advance past the first 3
    vi.advanceTimersByTime(30_001)
    // Now only 2 timestamps remain in window
    expect(checkRateLimit('ip-1').allowed).toBe(true)
  })
})
