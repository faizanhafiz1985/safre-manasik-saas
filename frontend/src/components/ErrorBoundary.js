import React from 'react';

// Global error boundary. A render-time exception anywhere in the tree (e.g. an
// unexpected data shape from the API) would otherwise leave the user staring at
// a blank white screen. This catches it and shows a recoverable "reload" card —
// the most common real-world cause is a stale cached bundle after a deploy, which
// a reload fixes immediately.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep a console trail for diagnostics without crashing the app.
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    // Hard reload to pull the latest bundle (defeats any stale cache).
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F3F8F5', fontFamily: "'Segoe UI', Arial, sans-serif", padding: 24,
      }}>
        <div style={{
          maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(13,43,26,0.12)', padding: '32px 28px', textAlign: 'center',
          borderTop: '4px solid #C9A227',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', color: '#0D2B1A', fontSize: 20 }}>Something went wrong</h2>
          <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
            This page hit an unexpected error. This usually clears after reloading — your
            data is safe. If it keeps happening, please contact support.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: '#1B4B35', color: '#fff', border: 'none', padding: '11px 28px',
              borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
