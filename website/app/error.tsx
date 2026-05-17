'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '2rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '3rem 2rem',
          textAlign: 'center',
          borderColor: 'var(--border-2)',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🙏</div>

        <h2
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: '1.75rem',
            color: 'var(--text)',
            marginBottom: '0.75rem',
          }}
        >
          Something went wrong
        </h2>

        <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: '2rem' }}>
          An unexpected error occurred. Please try again or return to the home page.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset} className="btn-primary" style={{ minWidth: '140px' }}>
            Try Again
          </button>
          <Link href="/" className="btn-secondary" style={{ minWidth: '140px' }}>
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
