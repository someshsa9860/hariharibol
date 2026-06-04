import Link from 'next/link';
import { Heart, Mail, Smartphone } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
      <div className="container-site py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <div className="text-2xl font-bold mb-2" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
                <span style={{ color: 'var(--accent)' }}>Hariharibol</span>
              </div>
              <p className="text-xs font-semibold tracking-widest" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
                BY CALLVCAL TECHNOLOGY PVT LTD
              </p>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-2)' }}>
              A comprehensive platform by Callvcal Technology for sacred Vedic wisdom, authentic spiritual teachings, and AI-powered guidance from the world's oldest wisdom traditions.
            </p>
            <div className="flex gap-4">
              <a href="mailto:contact@hariharibol.com" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                <Mail size={16} />
                Contact
              </a>
              <a href="#" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                <Smartphone size={16} />
                Download App
              </a>
            </div>
          </div>

          {/* Explore Content */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text)' }}>Content</h4>
            <ul className="space-y-3">
              {[
                { href: '/books',        label: 'Sacred Texts' },
                { href: '/sampradayas',  label: 'Traditions' },
                { href: '/verse-of-day', label: 'Verse of Day' },
                { href: '/mantras',      label: 'Mantras' },
                { href: '/search',       label: 'Search' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm transition-colors duration-200 hover:font-semibold" style={{ color: 'var(--text-2)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account & Access */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text)' }}>Access</h4>
            <ul className="space-y-3">
              {[
                { href: '/login',     label: 'Sign In' },
                { href: '/books',     label: 'Start Learning' },
                { href: '#',          label: 'Mobile App' },
                { href: '#',          label: 'Web App' },
                { href: '#',          label: 'API Docs' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm transition-colors duration-200 hover:font-semibold" style={{ color: 'var(--text-2)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community & Support */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text)' }}>Community</h4>
            <ul className="space-y-3">
              {[
                { href: '#', label: 'About Us' },
                { href: '#', label: 'Blog' },
                { href: '#', label: 'Guides' },
                { href: '#', label: 'FAQ' },
                { href: '#', label: 'Support' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm transition-colors duration-200 hover:font-semibold" style={{ color: 'var(--text-2)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t mb-8" style={{ borderColor: 'var(--border)' }} />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
              © {currentYear} HariHariBol. Empowering spiritual growth through authentic Vedic wisdom.
            </p>
            <div className="flex gap-6 text-xs" style={{ color: 'var(--muted)' }}>
              <Link href="#" className="hover:underline">Privacy Policy</Link>
              <Link href="#" className="hover:underline">Terms of Service</Link>
              <Link href="#" className="hover:underline">Cookie Policy</Link>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
            <Heart size={16} style={{ color: 'var(--accent)' }} />
            Made with devotion for spiritual seekers worldwide
          </div>
        </div>
      </div>
    </footer>
  );
}
