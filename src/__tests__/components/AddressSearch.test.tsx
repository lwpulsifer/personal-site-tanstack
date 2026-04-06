import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { AddressSearch, type AddressResult } from '#/components/maps/AddressSearch'

const sampleResults = [
  { display_name: '3301 Lyon St, San Francisco, CA', lat: '37.8029', lon: '-122.4484' },
  { display_name: '123 Main St, San Francisco, CA', lat: '37.7900', lon: '-122.4000' },
]

// Wrapper that manages controlled state so userEvent.type actually updates the input.
function Wrapper({ onSelect = () => {} }: { onSelect?: (r: AddressResult) => void }) {
  const [value, setValue] = useState('')
  return <AddressSearch value={value} onChange={setValue} onSelect={onSelect} />
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(sampleResults),
  }) as unknown as typeof fetch
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('AddressSearch', () => {
  it('renders the input', () => {
    render(<Wrapper />)
    expect(screen.getByLabelText(/address/i)).toBeTruthy()
  })

  it('shows results after typing and debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Wrapper />)

    const input = screen.getByLabelText(/address/i)
    await user.type(input, '3301 Lyon')

    vi.advanceTimersByTime(500)

    await waitFor(() => {
      expect(screen.getByTestId('address-results')).toBeTruthy()
    })

    expect(screen.getByText(/3301 Lyon St, San Francisco/)).toBeTruthy()
    expect(screen.getByText(/123 Main St, San Francisco/)).toBeTruthy()
  })

  it('calls onSelect with lat/lng when a result is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onSelect = vi.fn()
    render(<Wrapper onSelect={onSelect} />)

    const input = screen.getByLabelText(/address/i)
    await user.type(input, '3301 Lyon')
    vi.advanceTimersByTime(500)

    await waitFor(() => {
      expect(screen.getByTestId('address-results')).toBeTruthy()
    })

    await user.click(screen.getByText(/3301 Lyon St, San Francisco/))

    expect(onSelect).toHaveBeenCalledWith({
      displayName: '3301 Lyon St, San Francisco, CA',
      lat: 37.8029,
      lng: -122.4484,
    })
  })

  it('does not search for queries shorter than 3 characters', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Wrapper />)

    const input = screen.getByLabelText(/address/i)
    await user.type(input, 'ab')
    vi.advanceTimersByTime(500)

    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByTestId('address-results')).toBeNull()
  })

  it('closes dropdown on Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Wrapper />)

    const input = screen.getByLabelText(/address/i)
    await user.type(input, '3301 Lyon')
    vi.advanceTimersByTime(500)

    await waitFor(() => {
      expect(screen.getByTestId('address-results')).toBeTruthy()
    })

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('address-results')).toBeNull()
  })
})
