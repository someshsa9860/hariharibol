import clsx from 'clsx';
import { Icon, type IconName } from '@/components/ui/icon';
import { Reveal } from '@/components/ui/reveal';
import { VerseQuote } from '@/components/ui/verse-quote';

const REASONS: { icon: IconName; title: string; text: string; highlight?: boolean }[] = [
  { icon: 'book', title: 'Learn with context', text: 'Read verses and slokas with simple explanations that make ancient wisdom feel close to home.' },
  { icon: 'volume', title: 'Chant with confidence', text: 'Listen, repeat, and find your rhythm with mantras in the language that feels natural to you.', highlight: true },
  { icon: 'heart', title: 'Keep the connection', text: 'Build a gentle daily habit, save what speaks to you, and return whenever you need a little stillness.' },
];

export function Why() {
  return (
    <section id="why" className="section page">
      <Reveal className="section-head center">
        <p className="eyebrow">Simple by design</p>
        <h2>Come as you are. Practice at your pace.</h2>
        <p>HariHariBol brings the wisdom of a living tradition into a clear, welcoming space.</p>
      </Reveal>
      <div className="why-grid">
        {REASONS.map((reason, index) => (
          <Reveal key={reason.title} as="article" delay={index * 110} className={clsx('why-card card card-hover', reason.highlight && 'why-card-hi')}>
            <span className="why-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="why-icon"><Icon name={reason.icon} size={26} /></span>
            <h3>{reason.title}</h3>
            <p>{reason.text}</p>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <VerseQuote className="center-quote" sanskrit="तद्विद्धि प्रणिपातेन परिप्रश्नेन सेवया" reference="Bhagavad Gita 4.34" meaning="Learn through humility, sincere questions, and service." />
      </Reveal>
    </section>
  );
}
