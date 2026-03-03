import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BuyMeACoffee } from '#/components/BuyMeACoffee'

const BMAC_URL = 'https://buymeacoffee.com/liam.pulsifer'

describe('BuyMeACoffee', () => {
  it('links to the correct URL and opens in a new tab safely', () => {
    render(<BuyMeACoffee />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe(BMAC_URL)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('footer variant shows "Buy me a coffee"', () => {
    render(<BuyMeACoffee />)
    expect(screen.getByRole('link', { name: 'Buy me a coffee' })).toBeTruthy()
  })

  it('prominent variant displays the provided label', () => {
    render(<BuyMeACoffee variant="prominent" label="Like the blog? Buy me a coffee!" />)
    expect(screen.getByRole('link', { name: 'Like the blog? Buy me a coffee!' })).toBeTruthy()
  })

  it('prominent variant has a default label when none is provided', () => {
    render(<BuyMeACoffee variant="prominent" />)
    expect(screen.getByRole('link', { name: 'Like this post? Buy me a coffee!' })).toBeTruthy()
  })
})
