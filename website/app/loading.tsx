export default function Loading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        gap: '1.5rem',
      }}
    >
      <style>{`
        @keyframes om-spin {
          0%   { transform: rotate(0deg) scale(1);   opacity: 0.8; }
          50%  { transform: rotate(180deg) scale(1.1); opacity: 1; }
          100% { transform: rotate(360deg) scale(1);  opacity: 0.8; }
        }
        .om-spinner {
          animation: om-spin 2s linear infinite;
          display: inline-block;
          font-size: 4rem;
          background: linear-gradient(135deg, #FF6B00, #7B1C1C);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <span className="om-spinner" aria-hidden="true">ॐ</span>

      <p
        style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: '1rem',
          color: 'var(--muted)',
          letterSpacing: '0.1em',
        }}
      >
        Loading…
      </p>
    </div>
  );
}
