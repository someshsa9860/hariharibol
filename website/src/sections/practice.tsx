import { Icon } from '@/components/icon';
import { Reveal } from '@/components/reveal';
import { Verse } from '@/components/verse';

const BENEFITS = [
  'Daily inspiration that meets you where you are',
  'Reading, meaning, and audio in one place',
  'Your language, your pace, your path',
];

// Eight petals, each the first one turned a further eighth of a circle.
const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function Practice() {
  return (
    <section id="practice" className="practice-section">
      <Reveal className="practice-art" aria-hidden="true">
        <span className="practice-orbit orbit-one"></span>
        <span className="practice-orbit orbit-two"></span>
        <svg className="practice-lotus" viewBox="0 0 200 200">
          <g className="petals">
            {PETAL_ANGLES.map((angle) => (
              <ellipse
                key={angle}
                cx="100"
                cy="58"
                rx="15"
                ry="40"
                transform={angle ? `rotate(${angle} 100 100)` : undefined}
              />
            ))}
          </g>
          <circle cx="100" cy="100" r="13" className="lotus-eye" />
        </svg>
        <span className="practice-badge">
          5<br />
          <small>MIN</small>
        </span>
      </Reveal>
      <Reveal className="practice-copy" delay={100}>
        <p className="eyebrow">A little, every day</p>
        <h2>Your practice does not need to be perfect. It just needs a beginning.</h2>
        <p>
          Start with one verse or one mantra. HariHariBol helps you stay close to your intention without adding noise to
          your day.
        </p>
        <ul className="check-list">
          {BENEFITS.map((benefit) => (
            <li key={benefit}>
              <span aria-hidden="true">
                <Icon name="check" />
              </span>{' '}
              {benefit}
            </li>
          ))}
        </ul>
        <Verse
          className="practice-verse"
          sanskrit="यतो यतो निश्चरति मनश्चञ्चलमस्थिरम्"
          reference="Bhagavad Gita 6.26"
          meaning="Whenever the restless mind wanders, gently bring it back."
        />
      </Reveal>
    </section>
  );
}
