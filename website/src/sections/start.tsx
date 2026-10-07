import { Icon } from '@/components/icon';
import { Verse } from '@/components/verse';
import { CONTACT_EMAIL, PLAY_STORE_URL } from '@/site';

export function Start() {
  return (
    <section id="start" className="start-section">
      <div className="start-inner">
        <p className="eyebrow">Your next small step</p>
        <h2>Begin with a single breath.</h2>
        <p>HariHariBol is being built for a calmer, more connected daily practice.</p>
        <div className="start-actions">
          <a className="button button-light" href={PLAY_STORE_URL} rel="noopener">
            Get it on Google Play <Icon name="arrow" />
          </a>
          <a className="button button-outline" href={`mailto:${CONTACT_EMAIL}?subject=I%20want%20to%20learn`}>
            Keep me close
          </a>
        </div>
        <Verse
          className="start-verse"
          sanskrit="मामेकं शरणं व्रज"
          reference="Bhagavad Gita 18.66"
          meaning="Come to Me for refuge; begin with trust."
        />
      </div>
    </section>
  );
}
