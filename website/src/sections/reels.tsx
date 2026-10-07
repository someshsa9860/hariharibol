import type { ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Reveal } from '@/components/reveal';
import { Verse } from '@/components/verse';

// `tone` picks the card's colour in reels.css.
const REELS: { tone: 'gold' | 'green' | 'plum'; length: string; title: ReactNode; caption: string }[] = [
  {
    tone: 'gold',
    length: '0:47',
    title: (
      <>
        The sound of a<br />
        morning mantra
      </>
    ),
    caption: 'Listen for 0:47',
  },
  {
    tone: 'green',
    length: '1:12',
    title: (
      <>
        Why we light
        <br />a diya
      </>
    ),
    caption: 'Watch for 1:12',
  },
  {
    tone: 'plum',
    length: '0:58',
    title: (
      <>
        A verse for
        <br />
        uncertain days
      </>
    ),
    caption: 'Listen for 0:58',
  },
];

export function Reels() {
  return (
    <section id="reels" className="page-section reels-section">
      <Reveal className="section-heading split-heading">
        <div>
          <p className="eyebrow">Wisdom in motion</p>
          <h2>Small moments of devotion, shared.</h2>
        </div>
        <p>Find a new perspective in a minute. Discover chants, stories, and gentle reminders from the community.</p>
      </Reveal>
      <div className="reel-row">
        {REELS.map((reel, index) => (
          <Reveal key={reel.length} as="article" className={`reel-card reel-card-${reel.tone}`} delay={index * 100}>
            <div className="reel-top">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span className="reel-pill">{reel.length}</span>
            </div>
            <span className="reel-play" aria-hidden="true">
              <Icon name="play" />
            </span>
            <div>
              <strong>{reel.title}</strong>
              <small>{reel.caption}</small>
            </div>
          </Reveal>
        ))}
      </div>
      <Verse
        reveal
        className="reels-verse"
        sanskrit="बोधयन्तः परस्परं कथयन्तश्च मां नित्यम्"
        reference="Bhagavad Gita 10.9"
        meaning="They share wisdom and speak of the Divine with one another."
      />
    </section>
  );
}
