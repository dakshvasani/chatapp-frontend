// src/components/ErrorBoundary.jsx
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // This is exactly what you need to screenshot/paste to debug future crashes
    console.error('ChatPage crashed:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#c00' }}>Something went wrong</h2>
          <p style={{ color: '#555' }}>
            An error occurred while rendering the chat. Open DevTools Console (F12) to see the
            exact error below, then copy it to fix the cause.
          </p>
          <pre
            style={{
              background: '#f5f5f5',
              padding: '1rem',
              borderRadius: '6px',
              overflowX: 'auto',
              fontSize: '0.85rem',
              color: '#a00',
            }}
          >
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={this.handleReset}
            style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
