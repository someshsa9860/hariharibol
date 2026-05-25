import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
      <div className="container-site py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="text-xl font-bold mb-3" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
              <span style={{ color: 'var(--accent)' }}>Hari</span>HariBol
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-2)' }}>
              Explore sacred verses, ancient mantras, and spiritual wisdom from the world's oldest traditions in 50+ languages.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text)' }}>Explore</h4>
            <ul className="space-y-3">
              {[
                { href: '/books',        label: 'Sacred Books' },
                { href: '/sampradayas',  label: 'Traditions' },
                { href: '/verse-of-day', label: 'Verse of Day' },
                { href: '/mantras',      label: 'Mantras' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm transition-colors hover:text-[var(--accent)]" style={{ color: 'var(--text-2)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text)' }}>Account</h4>
            <ul className="space-y-3">
              {[
                { href: '/login',  label: 'Sign In' },
                { href: '/app',    label: 'Open Web App' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm transition-colors hover:text-[var(--accent)]" style={{ color: 'var(--text-2)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t" style={{ borderColor: 'var(--border)' }} />

        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            © 2026 HariHariBol. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Exploring Vedic wisdom with devotion
          </p>
        </div>
      </div>
    </footer>
  );
}
