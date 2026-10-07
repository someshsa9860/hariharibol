import clsx from 'clsx';
import { Icon, type IconName } from '@/components/icon';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';
import { Verse } from '@/components/verse';

const REASONS: { icon: IconName; title: string; text: string; highlight?: boolean }[] = [
  {
    icon: 'book',
    title: 'Learn with context',
    text: 'Read verses and slokas with simple explanations that make ancient wisdom feel close to home.',
  },
  {
    icon: 'sound',
    title: 'Chant with confidence',
    text: 'Listen, repeat, and find your rhythm with mantras in the language that feels natural to you.',
    highlight: true,
  },
  {
    icon: 'heart',
    title: 'Keep the connection',
    text: 'Build a gentle daily habit, save what speaks to you, and return whenever you need a little stillness.',
  },
];

export function Why() {
  return (
    <section id="why" className="page-section intro-section">
      <SectionHeading eyebrow="Simple by design" title="Come as you are. Practice at your pace.">
        HariHariBol brings the wisdom of a living tradition into a clear, welcoming space.
      </SectionHeading>
      <div className="feature-grid">
        {REASONS.map((reason, index) => (
          <Reveal
            key={reason.title}
            as="article"
            className={clsx('feature-card', reason.highlight && 'feature-card-highlight')}
            delay={index * 100}
          >
            <span className="feature-number">{String(index + 1).padStart(2, '0')}</span>
            <div className="feature-icon">
              <Icon name={reason.icon} />
            </div>
            <h3>{reason.title}</h3>
            <p>{reason.text}</p>
          </Reveal>
        ))}
      </div>
      <Verse
        reveal
        sanskrit="तद्विद्धि प्रणिपातेन परिप्रश्नेन सेवया"
        reference="Bhagavad Gita 4.34"
        meaning="Learn through humility, sincere questions, and service."
      />
    </section>
  );
}
