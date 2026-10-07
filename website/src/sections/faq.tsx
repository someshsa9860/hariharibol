import { Icon } from '@/components/icon';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';

const FAQS = [
  {
    question: 'What is HariHariBol?',
    answer:
      'HariHariBol is a calm place to read Vedic verses with their meaning, listen to mantras and chant along, and watch short devotional reels - all in one app.',
  },
  {
    question: 'Is it free to use?',
    answer:
      'Yes. You can start on the free plan without paying anything. Optional paid plans add more for those who want it.',
  },
  {
    question: 'Which languages are supported?',
    answer:
      'Mantras come in Sanskrit with their meanings in English, Hindi, Marathi, Kannada, Tamil, Telugu, Malayalam, Bengali, Gujarati, Odia, Punjabi, and Assamese.',
  },
  {
    question: 'How does chanting work?',
    answer:
      'Pick a mantra, listen, and chant along. The app keeps count of your rounds so you can keep your attention on the sound instead of the number.',
  },
  {
    question: 'Where do the meanings come from?',
    answer:
      'Verses keep their Sanskrit original, with meanings from translators and commentators within the devotional tradition.',
  },
  {
    question: 'Can I share what I find?',
    answer:
      'Yes. Like, save, and share reels with friends and family, so a good verse can travel further than you do.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="page-section faq-section">
      <SectionHeading eyebrow="Good to know" title="Questions, answered simply." />
      <Reveal className="faq-list">
        {FAQS.map((faq, index) => (
          // Sharing a name makes the browser keep one answer open at a time.
          <details key={faq.question} className="faq-item" name="faq" open={index === 0}>
            <summary>
              {faq.question} <Icon name="chevron" className="faq-icon" />
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}
