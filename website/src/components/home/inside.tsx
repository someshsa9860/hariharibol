import clsx from 'clsx';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/icon';
import { Reveal } from '@/components/ui/reveal';

// Small drawings of each part of the site, built from the same CSS as the real thing. Decorative, so hidden from
// screen readers.
function ReadPreview() {
  return (
    <div className="pv pv-read" aria-hidden="true">
      <small>BHAGAVAD GITA 2.47</small>
      <p className="deva">कर्मण्येवाधिकारस्ते मा फलेषु कदाचन</p>
      <i /><i className="short" />
      <p className="pv-meaning">Your right is to the work, not to its fruits.</p>
    </div>
  );
}
function ChantPreview() {
  return (
    <div className="pv pv-chant" aria-hidden="true">
      <div className="pv-ring"><span>47</span><small>of 108</small></div>
      <p className="deva">हरे कृष्ण हरे कृष्ण</p>
    </div>
  );
}
function WatchPreview() {
  return (
    <div className="pv pv-watch" aria-hidden="true">
      <div className="pv-frame"><Icon name="play" size={34} /><p className="deva">श्रीकृष्ण शरणं मम</p></div>
      <div className="pv-rail"><Icon name="heart" size={18} /><Icon name="comment" size={18} /><Icon name="share" size={18} /></div>
    </div>
  );
}
function SakhaPreview() {
  return (
    <div className="pv pv-chat" aria-hidden="true">
      <p className="me">I find it hard to chant every day.</p>
      <p className="bot">Hari Bol! Even a few minutes counts. Would you like a simple plan to begin with one round?</p>
      <span className="typing"><i /><i /><i /></span>
    </div>
  );
}

const ITEMS: { icon: IconName; title: string; text: string; href: string; cta: string; Preview: () => React.JSX.Element }[] = [
  { icon: 'book', title: 'Verses with meaning', text: 'Read the Sanskrit, then the meaning in the language you think in. Listen to each verse recited — and read without an account.', href: '/read', cta: 'Open the library', Preview: ReadPreview },
  { icon: 'chant', title: 'Mantras to chant', text: 'Pick a mantra, listen, and let the counter keep your rounds so your attention stays on the sound.', href: '/jap', cta: 'Start chanting', Preview: ChantPreview },
  { icon: 'reels', title: 'Reels of devotion', text: 'Short stories, chants, and verses to watch in a minute. Like them, save them, share them with family.', href: '/reels', cta: 'Watch reels', Preview: WatchPreview },
  { icon: 'sakha', title: 'Sakha, a devotional friend', text: 'Ask a question, share a struggle, or just talk. Sakha answers warmly, one small step at a time.', href: '/sakha', cta: 'Talk with Sakha', Preview: SakhaPreview },
];

export function Inside() {
  return (
    <section id="features" className="section inside">
      <div className="page">
        <Reveal className="section-head center">
          <p className="eyebrow">On the website and in the app</p>
          <h2>Read it. Chant it. Watch it. Ask it.</h2>
          <p>Small habits that fit into the gaps of an ordinary day.</p>
        </Reveal>
        <div className="inside-list">
          {ITEMS.map((item, index) => (
            <Reveal key={item.title} className={clsx('inside-row', index % 2 === 1 && 'flip')}>
              <div className="inside-copy">
                <span className="why-icon"><Icon name={item.icon} size={26} /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link href={item.href} className="text-link">{item.cta} <Icon name="arrow" size={16} /></Link>
              </div>
              <div className="inside-stage"><item.Preview /></div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
