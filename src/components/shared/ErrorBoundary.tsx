import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Pocket Advisor error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-warning" />
            </div>
            <h1 className="text-text-primary text-lg font-bold mb-2">Something went wrong</h1>
            <p className="text-text-muted text-sm mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-xl font-medium text-sm active:scale-95 transition-transform"
            >
              <RefreshCw size={16} />
              Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
