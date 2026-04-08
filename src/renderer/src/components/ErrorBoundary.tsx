import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
          <h1 className="text-2xl font-bold text-danger">Something went wrong</h1>
          <pre className="max-w-xl overflow-auto rounded bg-default-100 p-4 text-sm">
            {this.state.error.message}
          </pre>
          <button
            className="rounded bg-primary px-4 py-2 text-white"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
