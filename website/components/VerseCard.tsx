'use client';

import { useState } from 'react';
import { Heart, Share2, ChevronDown, ChevronUp } from 'lucide-react';

interface Verse {
  id: string;
  verseNumber?: string;
  bookName?: string;
  chapterNumber?: number;
  verseText?: string;
  transliteration?: string;
  translation?: string;
  commentary?: string;
  wordMeanings?: { word: string; meaning: string }[];
}

interface Props {
  verse: Verse;
  showFavorite?: boolean;
  compact?: boolean;
}

export default function VerseCard({ verse, showFavorite = false, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const share = () => {
    const text = `${verse.verseText || ''}\n\n— ${verse.bookName || ''} ${verse.verseNumber || ''}`;
    if (navigator.share) {
      navigator.share({ title: 'HariHariBol Verse', text });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="verse-card animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          {verse.verseNumber && (
            <span className="badge text-xs mb-2 inline-block">
              {verse.bookName ? `${verse.bookName} ` : ''}{verse.verseNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {showFavorite && (
            <button
              onClick={() => setFavorited(!favorited)}
              className="btn-ghost p-2 rounded-xl"
              style={{ color: favorited ? '#e53e3e' : 'var(--muted)' }}
            >
              <Heart size={16} fill={favorited ? 'currentColor' : 'none'} />
            </button>
          )}
          <button onClick={share} className="btn-ghost p-2 rounded-xl">
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Sanskrit */}
      {verse.verseText && (
        <p className="verse-sanskrit mb-3 whitespace-pre-line">{verse.verseText}</p>
      )}

      {/* Transliteration */}
      {verse.transliteration && !compact && (
        <p className="verse-iast text-sm mb-4 whitespace-pre-line">{verse.transliteration}</p>
      )}

      {/* Word meanings */}
      {verse.wordMeanings && verse.wordMeanings.length > 0 && !compact && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="word-table w-full">
            <tbody>
              {verse.wordMeanings.map((wm, i) => (
                <tr key={i}>
                  <td>{wm.word}</td>
                  <td>{wm.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Translation */}
      {verse.translation && (
        <p className="verse-translation">{verse.translation}</p>
      )}

      {/* Commentary toggle */}
      {verse.commentary && !compact && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {expanded ? 'Hide Purport' : 'Read Purport'}
          </button>
          {expanded && (
            <div
              className="mt-3 text-sm leading-relaxed p-4 rounded-xl animate-fade-in"
              style={{ background: 'var(--surface)', color: 'var(--text-2)', borderLeft: '3px solid var(--accent-2)' }}
            >
              {verse.commentary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
