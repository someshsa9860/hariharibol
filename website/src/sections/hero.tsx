import { Icon } from '@/components/icon';
import { Verse } from '@/components/verse';

export function Hero() {
  return (
    <section className="hero page-section">
      <div className="hero-copy">
        <p className="eyebrow">A quieter way to grow</p>
        <h1>Make room for the sacred in your everyday.</h1>
        <p className="hero-text">
          Learn timeless verses, understand their meaning, and build a steady mantra practice - one simple moment at a
          time.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#start">
            Begin your journey <Icon name="arrow" />
          </a>
          <a className="text-link" href="#why">
            See how it works <Icon name="down" />
          </a>
        </div>
        <div className="quiet-note">
          <span className="note-dot" aria-hidden="true"></span>
          Made for curious hearts, wherever they are.
        </div>
        <Verse
          className="hero-verse"
          sanskrit="कर्मण्येवाधिकारस्ते मा फलेषु कदाचन"
          reference="Bhagavad Gita 2.47"
          meaning="Your right is to the work, not to its fruits."
        />
      </div>
      <div className="hero-visual">
        <div className="hero-sun" aria-hidden="true"></div>
        <div className="hero-art">
          <img
            className="hero-photo"
            src="/img/krishna.jpg"
            width={770}
            height={524}
            fetchPriority="high"
            alt="A small figure of Krishna playing the flute, wreathed in incense smoke among pink lotuses"
          />
        </div>
        <div className="art-card art-card-top">
          <span className="card-label">TODAY'S VERSE</span>
          <strong lang="sa">शान्तिः शान्तिः शान्तिः</strong>
          <small>Peace in thought, word, and action.</small>
        </div>
        <div className="art-card art-card-bottom">
          <span className="play-icon" aria-hidden="true">
            <Icon name="play" />
          </span>
          <span>
            <strong>Listen &amp; chant</strong>
            <small>Take 5 mindful minutes</small>
          </span>
        </div>
      </div>
    </section>
  );
}
