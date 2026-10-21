import { Icon } from '@/components/ui/icon';
import { Reveal } from '@/components/ui/reveal';

export const FAQS = [
  { question: 'What is HariHariBol?', answer: 'HariHariBol is a calm place to read Vedic verses with their meaning, listen to mantras and chant along, watch short devotional reels, and talk with Sakha — on the website and in the app.' },
  { question: 'Do I need an account?', answer: 'No. You can read the library, chant and watch reels without signing in. An account (Google or Apple) saves your progress and streak across devices, and is needed to talk with Sakha.' },
  { question: 'Is it free to use?', answer: 'Yes. You can start on the free plan without paying anything. Optional paid plans give Sakha more replies each month.' },
  { question: 'Which languages are supported?', answer: 'Verses and mantras keep their Sanskrit original, with meanings in English, Hindi, Marathi, Kannada, Tamil, Telugu, Malayalam, Bengali, Gujarati, Odia, Punjabi and Assamese. Choose yours from the globe in the top bar.' },
  { question: 'Where do the meanings come from?', answer: 'Verses keep their Sanskrit original, with meanings from translators and commentators within the devotional tradition. Some translations into other languages are machine-assisted and being reviewed.' },
  { question: 'What is Sakha?', answer: 'Sakha is a digital companion — not a person — that speaks with warmth from the heart of Vaishnava bhakti, welcomes everyone, and never pressures. It can make mistakes, so please check important things with a teacher.' },
];

export function Faq() {
  return (
    <section id="faq" className="section page faq-section">
      <Reveal className="section-head center">
        <p className="eyebrow">Good to know</p>
        <h2>Questions, answered simply.</h2>
      </Reveal>
      <Reveal className="faq-list">
        {FAQS.map((faq, index) => (
          // Sharing a name makes the browser keep one answer open at a time.
          <details key={faq.question} className="faq-item" name="faq" open={index === 0}>
            <summary>{faq.question} <Icon name="down" className="faq-icon" /></summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}
