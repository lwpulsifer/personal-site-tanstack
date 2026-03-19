import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  fallback?: ReactNode | ((error: Error) => ReactNode)
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error)
          : this.props.fallback
      }

      return (
        <div
          role="alert"
          style={{
            border: '1px solid var(--border)',
            borderRadius: '12px',
            backgroundColor: 'var(--surface)',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--text)', fontWeight: 600, margin: '0 0 8px' }}>
            Something went wrong
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 16px' }}>
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.reset}
            style={{
              backgroundColor: 'var(--blue-deep)',
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              padding: '6px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
