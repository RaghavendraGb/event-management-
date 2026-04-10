import React from 'react';
import { Link } from 'react-router-dom';

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ROUTE_CRASH_CAPTURED', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    // Reset fallback when route changes so users can continue navigating.
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 12,
        padding: 24,
        maxWidth: 760,
        margin: '12px auto',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          This page hit an error
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          The rest of the app is still running. You can go home or navigate to another page.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <Link to="/" className="btn-primary">Go Home</Link>
          <button
            className="btn-ghost"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry Page
          </button>
        </div>

        {this.state.error?.message && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>
            {this.state.error.message}
          </p>
        )}
      </div>
    );
  }
}
