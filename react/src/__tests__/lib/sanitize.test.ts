import { describe, expect, it } from 'vitest'
import { sanitize } from '#/lib/sanitize'

describe('sanitize', () => {
  it('passes safe HTML through unchanged', () => {
    const html = '<p>Hello <strong>world</strong></p>'
    expect(sanitize(html)).toBe(html)
  })

  it('strips script tags', () => {
    const result = sanitize('<script>alert("xss")</script><p>safe</p>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('safe')
  })

  it('strips inline event handlers', () => {
    const result = sanitize('<p onclick="alert()">click me</p>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('click me')
  })

  it('strips javascript: URLs', () => {
    const result = sanitize('<a href="javascript:alert()">click</a>')
    expect(result).not.toContain('javascript:')
  })

  it('returns an empty string for empty input', () => {
    expect(sanitize('')).toBe('')
  })
})
