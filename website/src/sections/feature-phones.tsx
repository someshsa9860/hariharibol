import { Icon } from '@/components/icon';

// The three phone screens shown beside the feature tabs. They are drawings,
// not the real app, so they are hidden from screen readers.

export function ReadPhone() {
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-bar">
        <span>Bhagavad Gita</span>
        <small>2.47</small>
      </div>
      <div className="phone-body">
        <p className="mock-sanskrit">
          कर्मण्येवाधिकारस्ते
          <br />
          मा फलेषु कदाचन ।
        </p>
        <div className="mock-chips">
          <span className="is-on">Sanskrit</span>
          <span>English</span>
          <span>हिन्दी</span>
        </div>
        <p className="mock-meaning">Your right is to the work, not to its fruits.</p>
        <div className="mock-audio">
          <span className="mock-play">
            <Icon name="play" />
          </span>
          <span className="mock-wave"></span>
        </div>
      </div>
    </div>
  );
}

export function ChantPhone() {
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-bar">
        <span>Chant</span>
        <small>Round 1</small>
      </div>
      <div className="phone-body phone-body-center">
        <div className="mala">
          <svg viewBox="0 0 160 160">
            <circle className="mala-track" cx="80" cy="80" r="68" pathLength="100" />
            <circle className="mala-fill" cx="80" cy="80" r="68" pathLength="100" />
          </svg>
          <div className="mala-count">
            <strong>54</strong>
            <small>of 108</small>
          </div>
        </div>
        <p className="mock-mantra">
          Hare Krishna Hare Krishna
          <br />
          Krishna Krishna Hare Hare
        </p>
      </div>
    </div>
  );
}

export function WatchPhone() {
  return (
    <div className="phone phone-dark" aria-hidden="true">
      <div className="reel-screen">
        <span className="reel-ring reel-ring-one"></span>
        <span className="reel-ring reel-ring-two"></span>
        <ul className="reel-actions">
          <li>
            <Icon name="heart" />
          </li>
          <li>
            <Icon name="comment" />
          </li>
          <li>
            <Icon name="share" />
          </li>
        </ul>
        <div className="reel-caption">
          <strong>
            A verse for
            <br />
            uncertain days
          </strong>
          <small>Listen for 0:58</small>
        </div>
        <span className="reel-progress"></span>
      </div>
    </div>
  );
}
