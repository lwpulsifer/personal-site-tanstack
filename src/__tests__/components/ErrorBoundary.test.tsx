import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '#/components/ErrorBoundary'

function ThrowingChild({ message }: { message: string }): React.ReactNode {
  throw new Error(message)
}

// Suppress React's error boundary console.error noise in test output.
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeTruthy()
  })

  it('renders the default fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="kaboom" />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('kaboom')).toBeTruthy()
  })

  it('renders a static fallback node when provided', () => {
    render(
      <ErrorBoundary fallback={<p>Custom fallback</p>}>
        <ThrowingChild message="oops" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom fallback')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders a function fallback with the error', () => {
    render(
      <ErrorBoundary fallback={(err) => <p>Failed: {err.message}</p>}>
        <ThrowingChild message="broken" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Failed: broken')).toBeTruthy()
  })

  it('resets and re-renders children when "Try again" is clicked', async () => {
    let shouldThrow = true
    function MaybeThrow() {
      if (shouldThrow) throw new Error('first render')
      return <p>Recovered</p>
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText('first render')).toBeTruthy()

    shouldThrow = false
    await userEvent.click(screen.getByText('Try again'))
    expect(screen.getByText('Recovered')).toBeTruthy()
  })
})
