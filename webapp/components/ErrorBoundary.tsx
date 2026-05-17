'use client';

import React from 'react';

interface Props { children: React.ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: 32,
            background: 'var(--bg, #fff)',
            color: 'var(--text, #1a1a1a)',
            textAlign: 'center',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '1.75rem',
              fontWeight: 700,
              margin: 0,
            }}
          >
            Something went wrong
          </h2>
          <p style={{ color: 'var(--text-2, #666)', maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
            An unexpected error occurred. Please reload the page to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 28px',
              borderRadius: 12,
              border: 'none',
              background: '#C75A1A',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.95rem',
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
