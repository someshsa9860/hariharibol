'use client';

import { useEffect, useState } from 'react';
import { Share2, Bookmark, BookmarkCheck, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';
import { format } from 'date-fns';

const PLACEHOLDER_VOD = {
  verseText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।',
  transliteration: 'karmaṇy-evādhikāras te mā phaleṣu kadācana',
  translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.',
  commentary: 'This verse from the Bhagavad Gita encapsulates the doctrine of Nishkama Karma — selfless action performed without attachment to results. Krishna instructs Arjuna to focus entirely on the quality of his actions, surrendering all outcomes to the divine will. It is the cornerstone of Karma Yoga.',
  verseNumber: '2.47', bookName: 'Bhagavad Gita',
};

const PLACEHOLDER_RELATED = [
  { id: '1', verseText: 'योगस्थः कुरु कर्माणि', translation: 'Be steadfast in yoga and perform your actions.', verseNumber: '2.48', bookName: 'Bhagavad Gita' },
  { id: '2', verseText: 'सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज', translation: 'Abandon all varieties of dharma and simply surrender unto Me.', verseNumber: '18.66', bookName: 'Bhagavad Gita' },
  { id: '3', verseText: 'मन एव मनुष्याणां कारणं बन्धमोक्षयोः', translation: 'The mind alone is the cause of bondage and liberation for human beings.', verseNumber: '6.5', bookName: 'Amritabindu Upanishad' },
];

export default function AppVODPage() {
  const [vod, setVod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<any[]>([]);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    api.get('/verses/of-day/today')
      .then(r => setVod(r.data?.verse || r.data))
      .catch(() => setVod(PLACEHOLDER_VOD))
      .finally(() => setLoading(false));

    api.get('/verses?take=5')
      .then(r => setRelated(r.data?.data || r.data?.verses || PLACEHOLDER_RELATED))
      .catch(() => setRelated(PLACEHOLDER_RELATED));
  }, []);

  const share = () => {
    if (!vod) return;
    const text = `${vod.verseText}\n\n${vod.translation}\n— ${vod.bookName} ${vod.verseNumber}`;
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Verse of the Day" />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
        {/* Date row */}
        <p style={{
          fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '1.25rem',
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          {format(new Date(), 'EEEE, MMMM d · yyyy')}
        </p>

        {loading ? (
          <div className="verse-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton" style={{ height: 24, width: '75%', borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 20, width: '100%', borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 20, width: '66%', borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 14, width: '100%', borderRadius: 8 }} />
          </div>
        ) : vod ? (
          <>
            {/* Hero card — sandstone bg with giant decorative quote mark */}
            <div style={{
              background: '#C4A882', borderRadius: 20,
              padding: '2rem 1.75rem', position: 'relative', overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(196,168,130,0.4)',
              marginBottom: '1.5rem',
            }} className="animate-slide-up">

              {/* Decorative saffron quote mark */}
              <div style={{
                position: 'absolute', top: -12, left: 14,
                fontSize: '9rem', lineHeight: 1, color: '#FF6B00',
                opacity: 0.22, fontFamily: 'Georgia, serif', userSelect: 'none',
                pointerEvents: 'none',
              }}>"</div>

              {/* Sanskrit in Devanagari */}
              {vod.verseText && (
                <p style={{
                  fontFamily: '"Noto Sans Devanagari", serif',
                  fontSize: '1.35rem', lineHeight: 2.1, color: '#1A1410',
                  marginBottom: '0.75rem', position: 'relative', whiteSpace: 'pre-line',
                }}>{vod.verseText}</p>
              )}

              {/* Transliteration */}
              {vod.transliteration && (
                <p style={{
                  fontStyle: 'italic', color: '#4A3828', fontSize: '0.9rem',
                  lineHeight: 1.8, marginBottom: '1rem', opacity: 0.85,
                }}>{vod.transliteration}</p>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(74,56,40,0.2)', margin: '1rem 0' }} />

              {/* Translation */}
              {vod.translation && (
                <p style={{ color: '#2D1F14', fontSize: '0.95rem', lineHeight: 1.85, marginBottom: '1.25rem' }}>
                  {vod.translation}
                </p>
              )}

              {/* Source badge + action row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{
                  padding: '4px 12px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 700,
                  background: 'rgba(255,255,255,0.5)', color: '#4A3828',
                  border: '1px solid rgba(74,56,40,0.2)',
                }}>{vod.bookName} · {vod.verseNumber}</span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={share} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                    borderRadius: 20, border: '1.5px solid rgba(74,56,40,0.25)',
                    background: 'rgba(255,255,255,0.4)', color: '#4A3828',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s',
                  }}>
                    <Share2 size={13} /> Share
                  </button>
                  <button onClick={() => setBookmarked(b => !b)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                    borderRadius: 20, border: `1.5px solid ${bookmarked ? 'rgba(255,107,0,0.4)' : 'rgba(74,56,40,0.25)'}`,
                    background: bookmarked ? 'rgba(255,107,0,0.14)' : 'rgba(255,255,255,0.4)',
                    color: bookmarked ? '#FF6B00' : '#4A3828',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s',
                  }}>
                    {bookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                    {bookmarked ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            {/* Reflection of the day — forest green accent */}
            {vod.commentary && (
              <div style={{ marginBottom: '1.75rem' }}>
                <h2 style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '1.1rem', color: 'var(--text)',
                  marginBottom: '0.875rem',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ width: 4, height: 20, background: '#2D5A27', borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                  Reflection of the Day
                </h2>
                <div style={{
                  padding: '1.25rem 1.5rem', borderRadius: 14,
                  background: 'rgba(45,90,39,0.06)', borderLeft: '4px solid #2D5A27',
                  color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.9,
                }}>
                  {vod.commentary}
                </div>
              </div>
            )}

            {/* Related verses — horizontal scroll */}
            {related.length > 0 && (
              <div>
                <h2 style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.875rem',
                }}>Related Verses</h2>

                <div style={{
                  display: 'flex', gap: '0.875rem',
                  overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none',
                }}>
                  {related.map((v, i) => (
                    <div key={v.id || i} style={{
                      minWidth: 220, flexShrink: 0, padding: '1rem 1rem 0.875rem',
                      borderRadius: 14, background: 'var(--bg)',
                      border: '1px solid var(--border)', borderTop: '3px solid var(--accent)',
                      cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px var(--accent-glow)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                    >
                      {v.verseText && (
                        <p style={{
                          fontFamily: '"Noto Sans Devanagari", serif',
                          fontSize: '0.85rem', lineHeight: 1.9, color: 'var(--text)',
                          marginBottom: 6,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        } as React.CSSProperties}>{v.verseText}</p>
                      )}
                      {v.translation && (
                        <p style={{
                          fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        } as React.CSSProperties}>{v.translation}</p>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700 }}>
                          {v.bookName} {v.verseNumber}
                        </span>
                        <ChevronRight size={12} color="var(--muted)" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
