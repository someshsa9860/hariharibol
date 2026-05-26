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
        @keyframes feather-float {
          0%, 100% {
            transform: translateY(0) rotateZ(0deg);
            opacity: 0.8;
          }
          25% {
            transform: translateY(-8px) rotateZ(-5deg);
            opacity: 1;
          }
          50% {
            transform: translateY(-12px) rotateZ(0deg);
            opacity: 1;
          }
          75% {
            transform: translateY(-8px) rotateZ(5deg);
            opacity: 1;
          }
        }
        .feather-spinner {
          animation: feather-float 3s ease-in-out infinite;
          display: inline-block;
          color: var(--accent);
        }
      `}</style>

      <svg
        className="feather-spinner"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L5.41 12.84a5.5 5.5 0 0 0 7.78 7.78l8.63-8.63a1 1 0 0 0-1.41-1.41L11.78 19.2a3.5 3.5 0 0 1-4.95-4.95l8.63-8.63a1 1 0 0 0-1.41-1.41L5.41 12.84a5.5 5.5 0 0 0 7.78 7.78l8.63-8.63"></path>
      </svg>

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
