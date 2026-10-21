import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { VerseQuote } from '@/components/ui/verse-quote';
import { CONTACT_EMAIL } from '@/lib/config';

export function Start() {
  return (
    <section id="start" className="start-section">
      <div className="start-inner page">
        <p className="eyebrow">Your next small step</p>
        <h2>Begin with a single breath.</h2>
        <p>Read a verse now, or take HariHariBol with you.</p>
        <div className="start-actions">
          <Link className="btn btn-light btn-lg" href="/read">Open the library <Icon name="arrow" size={18} /></Link>
          <Link className="btn btn-outline btn-lg" href="/get-app">Get the app</Link>
          <a className="btn btn-outline btn-lg" href={`mailto:${CONTACT_EMAIL}?subject=I%20want%20to%20learn`}>Keep me close</a>
        </div>
        <VerseQuote className="start-verse" sanskrit="मामेकं शरणं व्रज" reference="Bhagavad Gita 18.66" meaning="Come to Me for refuge; begin with trust." />
      </div>
    </section>
  );
}
