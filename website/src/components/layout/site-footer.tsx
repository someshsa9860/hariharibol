import Link from 'next/link';
import { CONTACT_EMAIL, LEGAL_LINKS, PLAY_STORE_URL } from '@/lib/config';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page footer-grid">
        <div className="footer-brand">
          <Link href="/" className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo.png" alt="" width={34} height={34} />
            <span>HariHariBol</span>
          </Link>
          <p>Learn. Chant. Remember. A quiet place for verses, mantras and devotion.</p>
        </div>
        <nav aria-label="Explore">
          <h4>Explore</h4>
          <Link href="/read">Read</Link>
          <Link href="/jap">Jap</Link>
          <Link href="/reels">Reels</Link>
          <Link href="/sakha">Ask Sakha</Link>
          <Link href="/routine">Routine</Link>
          <Link href="/calendar">Calendar</Link>
        </nav>
        <nav aria-label="About">
          <h4>About</h4>
          <Link href="/plans">Plans</Link>
          <Link href="/sources">Sources &amp; disclaimer</Link>
          <a href={PLAY_STORE_URL} rel="noopener">Get the app</a>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
          {LEGAL_LINKS.map((link) => <a key={link.label} href={link.href} rel="noopener">{link.label}</a>)}
        </nav>
      </div>
      <div className="page footer-base">© {new Date().getFullYear()} HariHariBol · Hari Bol 🙏</div>
    </footer>
  );
}
