'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

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
      <div style={{ fontSize: 48 }}>🙏</div>
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
        An unexpected error occurred. You can try again or return home.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
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
          Try again
        </button>
        <Link
          href="/home"
          style={{
            padding: '10px 28px',
            borderRadius: 12,
            border: '1px solid var(--border, #ddd)',
            background: 'transparent',
            color: 'var(--text, #1a1a1a)',
            fontWeight: 600,
            fontSize: '0.95rem',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
