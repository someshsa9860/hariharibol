/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { VerseQuote } from '@/components/ui/verse-quote';

export function Hero() {
  return (
    <section className="hero page">
      <div className="hero-copy">
        <p className="eyebrow enter">A quieter way to grow</p>
        <h1 className="enter enter-1">Make room for the sacred in your everyday.</h1>
        <p className="hero-text enter enter-2">
          Learn timeless verses, understand their meaning, and build a steady mantra practice - one simple moment at a time.
        </p>
        <div className="hero-actions enter enter-3">
          <Link className="btn btn-primary btn-lg" href="/read">Start reading <Icon name="arrow" size={18} /></Link>
          <Link className="btn btn-ghost btn-lg" href="/sakha"><Icon name="sakha" size={18} /> Ask Sakha</Link>
        </div>
        <VerseQuote
          className="hero-verse enter enter-4"
          sanskrit="कर्मण्येवाधिकारस्ते मा फलेषु कदाचन"
          reference="Bhagavad Gita 2.47"
          meaning="Your right is to the work, not to its fruits."
        />
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="hero-sun" />
        <div className="hero-art">
          <img src="/img/krishna.jpg" width={770} height={524} alt="" fetchPriority="high" />
        </div>
        <div className="art-card art-card-top">
          <span className="eyebrow">Today’s verse</span>
          <strong lang="sa" className="deva">सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज</strong>
          <small>Bhagavad Gita 18.66 · Surrender to Me alone, and do not fear.</small>
        </div>
        <div className="art-card art-card-bottom">
          <span className="play-dot"><Icon name="play" size={16} /></span>
          <span><strong>Listen &amp; chant</strong><small>Take 5 mindful minutes</small></span>
        </div>
      </div>
    </section>
  );
}
