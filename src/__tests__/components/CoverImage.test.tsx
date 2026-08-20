import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoverImage } from '#/components/books/CoverImage'

describe('CoverImage', () => {
  it('renders the explicit cover url when given one', () => {
    const { container } = render(
      <CoverImage src="https://example.com/cover.jpg" isbn="9780593135204" />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/cover.jpg',
    )
  })

  it('falls back to the Open Library cover derived from the isbn when there is no explicit cover url', () => {
    const { container } = render(
      <CoverImage src={null} isbn="978-0-593-13520-4" />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg?default=false',
    )
  })

  it('shows the placeholder icon when there is neither a cover url nor a usable isbn', () => {
    const { container, getByText } = render(
      <CoverImage src={null} isbn={null} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(getByText('📖')).toBeTruthy()
  })

  it('drops to the placeholder icon if the Open Library cover fails to load', () => {
    const { container, getByText } = render(
      <CoverImage src={null} isbn="9780593135204" />,
    )
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    fireEvent.error(img as HTMLImageElement)
    expect(container.querySelector('img')).toBeNull()
    expect(getByText('📖')).toBeTruthy()
  })
})
