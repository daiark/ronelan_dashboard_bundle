import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state to show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // In production, you might want to send this to an error reporting service
    if (import.meta.env.PROD) {
      // Example: errorReportingService.captureException(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
          <div className="bg-dark-800 rounded-lg shadow-sm border border-red-200 p-8 max-w-2xl w-full">
            <div className="flex items-center mb-6">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-dark-100">
                  Monitoring Panel Error
                </h1>
                <p className="text-dark-300">
                  Something went wrong with the industrial monitoring interface
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-dark-100 mb-2">Error Details:</h3>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-800 font-mono">
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-accent-green-600 text-white rounded-lg hover:bg-accent-green-700 transition-colors"
              >
                Reload Application
              </button>
              
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-dark-700 text-dark-200 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Try Again
              </button>
            </div>

            {/* Development mode: Show stack trace */}
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mt-6">
                <summary className="text-sm font-medium text-dark-300 cursor-pointer">
                  Technical Details (Development Mode)
                </summary>
                <div className="mt-2 bg-dark-700 border border-dark-600 rounded p-3">
                  <pre className="text-xs text-dark-300 whitespace-pre-wrap">
                    {this.state.error?.stack}
                  </pre>
                  <pre className="text-xs text-dark-300 whitespace-pre-wrap mt-2">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
