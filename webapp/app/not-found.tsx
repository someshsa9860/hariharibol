import Link from 'next/link';

export default function NotFound() {
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
      <div
        style={{
          fontSize: '5rem',
          fontFamily: 'Noto Sans Devanagari, serif',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #C75A1A, #E8943A)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        ॐ
      </div>
      <h1
        style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: '2rem',
          fontWeight: 700,
          margin: 0,
        }}
      >
        Page not found
      </h1>
      <p style={{ color: 'var(--text-2, #666)', maxWidth: 400, margin: 0, lineHeight: 1.6 }}>
        The path you seek does not exist. Return to the sacred home.
      </p>
      <Link
        href="/home"
        style={{
          padding: '10px 28px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #C75A1A, #E8943A)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.95rem',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        Return Home
      </Link>
    </div>
  );
}
