import { Component, type ErrorInfo, type PropsWithChildren } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, any uncaught render error anywhere in the tree unmounts the whole app, leaving a
 * blank page with no indication anything went wrong. React error boundaries must be class
 * components - there's no hooks equivalent.
 */
export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Forgotten Wilds crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100svh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            background: '#120e0b',
            color: '#ece1cf',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ color: '#e0a94a', margin: 0 }}>Something went wrong.</h1>
          <p style={{ maxWidth: 480, opacity: 0.8 }}>{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#a8762c',
              border: '1px solid #6b4f2e',
              color: '#ece1cf',
              padding: '10px 20px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
