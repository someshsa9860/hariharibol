// Line art drawn here, not shipped as images: it takes the colour of whatever it sits on and stands in for a
// missing picture, so there is never a grey box.
type Kind = 'lotus' | 'sun' | 'conch' | 'flute';

export function Motif({ kind = 'lotus', className }: { kind?: Kind; className?: string }) {
  return (
    <svg className={className ?? 'motif'} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'lotus' && (
        <>
          <path d="M60 24c10 14 10 34 0 52-10-18-10-38 0-52Z" />
          <path d="M60 76C40 72 26 58 22 40c16 0 30 8 38 22" />
          <path d="M60 76c20-4 34-18 38-36-16 0-30 8-38 22" />
          <path d="M60 76c-26 2-42-8-50-24 16-4 34 0 50 24Z" opacity=".55" />
          <path d="M60 76c26 2 42-8 50-24-16-4-34 0-50 24Z" opacity=".55" />
          <path d="M34 94c16 6 36 6 52 0" opacity=".7" />
        </>
      )}
      {kind === 'sun' && (
        <>
          <circle cx="60" cy="60" r="20" />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * Math.PI) / 6;
            return <path key={i} d={`M${60 + Math.cos(angle) * 30} ${60 + Math.sin(angle) * 30}L${60 + Math.cos(angle) * 42} ${60 + Math.sin(angle) * 42}`} />;
          })}
        </>
      )}
      {kind === 'conch' && (
        <>
          <path d="M30 78c-8-20 4-46 30-50 22-3 36 12 32 30-3 14-16 22-30 20-12-2-18-12-14-22 3-8 14-10 20-4" />
          <path d="M30 78c6 8 14 12 24 12" />
        </>
      )}
      {kind === 'flute' && (
        <>
          <path d="M20 86 98 34" />
          <path d="M26 90 104 38" opacity=".6" />
          <circle cx="48" cy="68" r="2" /><circle cx="60" cy="60" r="2" /><circle cx="72" cy="52" r="2" />
        </>
      )}
    </svg>
  );
}
