/* eslint-disable @next/next/no-img-element */
export function Avatar({ name, url, size = 36 }: { name?: string | null; url?: string | null; size?: number }) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return url ? (
    <img src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  ) : (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 600, fontSize: size * 0.42 }}>
      {initial}
    </span>
  );
}
