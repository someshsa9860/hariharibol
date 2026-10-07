import { Icon } from '@/components/icon';
import { CONTACT_EMAIL, NAV_LINKS, PLAY_STORE_URL } from '@/site';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-about">
          <a className="brand" href="#top">
            <span className="brand-mark" aria-hidden="true">ॐ</span>
            <span>HariHariBol</span>
          </a>
          <p>Learn. Chant. Remember.</p>
        </div>
        <nav className="footer-links" aria-label="Explore">
          <h2>Explore</h2>
          {NAV_LINKS.map((link) => (
            <a key={link.id} href={`#${link.id}`}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="footer-links">
          <h2>Get in touch</h2>
          <a className="footer-mail" href={`mailto:${CONTACT_EMAIL}`}>
            <Icon name="mail" /> {CONTACT_EMAIL}
          </a>
          <a href={PLAY_STORE_URL} rel="noopener">
            Get it on Google Play
          </a>
        </div>
      </div>
      <p className="copyright">© 2026 HariHariBol</p>
    </footer>
  );
}
