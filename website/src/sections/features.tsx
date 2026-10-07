import { useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '@/components/icon';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';
import { ChantPhone, ReadPhone, WatchPhone } from './feature-phones';

const TABS: { id: string; icon: IconName; title: string; text: string; Phone: ComponentType }[] = [
  {
    id: 'read',
    icon: 'book',
    title: 'Verses with meaning',
    text: 'Read the Sanskrit, then the meaning in the language you think in. Listen to each verse recited.',
    Phone: ReadPhone,
  },
  {
    id: 'chant',
    icon: 'sound',
    title: 'Mantras to chant',
    text: 'Chant along with a mantra while the app keeps count of your rounds, so your attention stays on the sound.',
    Phone: ChantPhone,
  },
  {
    id: 'watch',
    icon: 'play',
    title: 'Reels of devotion',
    text: 'Short stories, chants, and verses to watch in a minute. Like them, save them, share them with family.',
    Phone: WatchPhone,
  },
];

export function Features() {
  const [selected, setSelected] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number, focus = false) => {
    setSelected(index);
    if (focus) tabRefs.current[index]?.focus();
  };

  // Arrow keys move between tabs and wrap around; Home and End jump to the ends.
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = TABS.length - 1;
    const next = index === last ? 0 : index + 1;
    const previous = index === 0 ? last : index - 1;
    const target = {
      ArrowDown: next,
      ArrowRight: next,
      ArrowUp: previous,
      ArrowLeft: previous,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target, true);
  };

  return (
    <section id="features" className="page-section features-section">
      <SectionHeading eyebrow="Inside the app" title="Read it. Chant it. Watch it.">
        Three small habits that fit into the gaps of an ordinary day.
      </SectionHeading>
      <Reveal className="feature-tabs">
        <div className="tab-list" role="tablist" aria-label="App features" aria-orientation="vertical">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              className="tab"
              id={`tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected === index}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="tab-icon">
                <Icon name={tab.icon} />
              </span>
              <span>
                <strong>{tab.title}</strong>
                <small>{tab.text}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="tab-stage">
          <div className="stage-disc" aria-hidden="true"></div>
          {TABS.map((tab, index) => (
            <div
              key={tab.id}
              className="tab-panel"
              id={`panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              hidden={selected !== index}
            >
              <tab.Phone />
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
