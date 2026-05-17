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
        background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-2) 100%)',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '8rem',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #FF6B00, #7B1C1C)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '1.5rem',
          animation: 'float 4s ease-in-out infinite',
        }}
      >
        ॐ
      </div>

      <p
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          marginBottom: '1rem',
        }}
      >
        404
      </p>

      <h1
        style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '1rem',
        }}
      >
        Page Not Found
      </h1>

      <p
        style={{
          fontSize: '1.1rem',
          color: 'var(--muted)',
          maxWidth: '440px',
          lineHeight: 1.7,
          marginBottom: '2.5rem',
        }}
      >
        The path you seek has not yet been written. Return to the source and continue your journey.
      </p>

      <Link href="/" className="btn-primary" style={{ fontSize: '1rem', padding: '14px 32px' }}>
        Return Home
      </Link>
    </div>
  );
}
