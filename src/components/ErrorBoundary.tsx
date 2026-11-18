import type { JSX } from '@solidjs/web'
import { Errored } from 'solid-js'

// Solid port of the React class boundary. <Errored> heals on its own when its
// inputs change, and `reset` re-runs the failed subtree ("Try again").
export function ErrorBoundary(props: {
  fallback?: JSX.Element | ((error: Error) => JSX.Element)
  children: JSX.Element
}) {
  return (
    <Errored
      fallback={(err: unknown, reset: () => void) => {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('ErrorBoundary caught:', error)
        if (props.fallback) {
          return typeof props.fallback === 'function'
            ? (props.fallback as (e: Error) => JSX.Element)(error)
            : props.fallback
        }
        return (
          <div
            role="alert"
            style={{
              border: '1px solid var(--border)',
              'border-radius': '12px',
              'background-color': 'var(--surface)',
              padding: '24px',
              'text-align': 'center',
            }}
          >
            <p style={{ color: 'var(--text)', 'font-weight': 600, margin: '0 0 8px' }}>
              Something went wrong
            </p>
            <p style={{ color: 'var(--text-muted)', 'font-size': '14px', margin: '0 0 16px' }}>
              {error.message}
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                'background-color': 'var(--blue-deep)',
                color: 'white',
                border: 'none',
                'border-radius': '9999px',
                padding: '6px 16px',
                'font-size': '14px',
                'font-weight': 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )
      }}
    >
      {props.children}
    </Errored>
  )
}
