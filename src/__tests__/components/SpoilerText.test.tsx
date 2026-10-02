import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  parseSpoilerSegments,
  ReviewText,
  redactSpoilers,
} from '#/components/books/SpoilerText'

describe('parseSpoilerSegments', () => {
  it('splits plain text with no spoilers into a single text segment', () => {
    expect(parseSpoilerSegments('just a normal review')).toEqual([
      { type: 'text', content: 'just a normal review' },
    ])
  })

  it('extracts a spoiler span in the middle of text', () => {
    expect(parseSpoilerSegments('before ||the butler did it|| after')).toEqual([
      { type: 'text', content: 'before ' },
      { type: 'spoiler', content: 'the butler did it' },
      { type: 'text', content: ' after' },
    ])
  })

  it('handles multiple spoilers', () => {
    expect(parseSpoilerSegments('||a|| and ||b||')).toEqual([
      { type: 'spoiler', content: 'a' },
      { type: 'text', content: ' and ' },
      { type: 'spoiler', content: 'b' },
    ])
  })

  it('leaves an unclosed || marker as plain text', () => {
    expect(parseSpoilerSegments('no closing || marker')).toEqual([
      { type: 'text', content: 'no closing || marker' },
    ])
  })
})

describe('redactSpoilers', () => {
  it('replaces spoiler content with a placeholder', () => {
    expect(redactSpoilers('before ||the ending|| after')).toBe(
      'before [spoiler] after',
    )
  })

  it('passes plain text through unchanged', () => {
    expect(redactSpoilers('no spoilers here')).toBe('no spoilers here')
  })
})

describe('ReviewText', () => {
  it('renders plain text with no spoiler markup', () => {
    render(<ReviewText text="a great book" />)
    expect(screen.getByText('a great book')).toBeTruthy()
    expect(screen.queryByTestId('spoiler')).toBeNull()
  })

  it('hides spoiler text until clicked, then reveals it', async () => {
    const user = userEvent.setup()
    render(<ReviewText text="it was good until ||he dies|| at the end" />)

    const spoiler = screen.getByTestId('spoiler')
    expect(spoiler.textContent).toBe('he dies')
    expect(spoiler.getAttribute('aria-pressed')).toBe('false')

    await user.click(spoiler)

    expect(spoiler.getAttribute('aria-pressed')).toBe('true')
  })
})
