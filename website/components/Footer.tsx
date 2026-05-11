import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
      <div className="container-site py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="text-xl font-bold mb-3 gradient-text" style={{ fontFamily: 'Playfair Display, serif' }}>
              HariHariBol
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
              A sacred space for Vedic learning — verses, mantras, and spiritual wisdom from the great traditions of India.
            </p>
            <div className="text-2xl" style={{ color: 'var(--accent)', fontFamily: 'Noto Sans Devanagari, serif' }}>
              ॐ
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>Explore</h4>
            <ul className="space-y-2">
              {[
                { href: '/books',        label: 'Sacred Books' },
                { href: '/sampradayas',  label: 'Traditions' },
                { href: '/verse-of-day', label: 'Verse of Day' },
                { href: '/mantras',      label: 'Mantras' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm transition-colors hover:text-saffron-500" style={{ color: 'var(--muted)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* App */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>Practice</h4>
            <ul className="space-y-2">
              {[
                { href: '/login',  label: 'Sign In' },
                { href: '/app',    label: 'Open Web App' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm transition-colors hover:text-saffron-500" style={{ color: 'var(--muted)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="divider-om text-sm mb-6" style={{ color: 'var(--border-2)' }}>
          <span style={{ color: 'var(--accent)', opacity: 0.5 }}>ॐ</span>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            © 2026 HariHariBol. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Serving the Vaishnava community with love and devotion
          </p>
        </div>
      </div>
    </footer>
  );
}
