import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
    
    // TODO: Send to error tracking service in production
    // if (import.meta.env.PROD) {
    //   sendToErrorTracking({ error, errorInfo });
    // }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          
          <h2 style={{ margin: '0 0 0.5rem', color: '#1e293b', fontSize: '1.5rem' }}>
            Something went wrong
          </h2>
          
          <p style={{ margin: '0 0 1.5rem', color: '#64748b', maxWidth: '400px' }}>
            We're sorry, but something unexpected happened. Please try again.
          </p>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Go to Dashboard
            </button>
          </div>
          
          {/* Show error details in development */}
          {import.meta.env.DEV && this.state.error && (
            <details style={{
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
              textAlign: 'left',
              maxWidth: '600px',
              width: '100%',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500, color: '#991b1b' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                color: '#7f1d1d',
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
