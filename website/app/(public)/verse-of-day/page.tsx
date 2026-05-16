'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Calendar, Link2, Share2, Check } from 'lucide-react';
import api from '@/lib/api';
import { SkeletonVerse } from '@/components/SkeletonCard';
import { format } from 'date-fns';

function ShareRow({ verse }: { verse: any }) {
  const [copied, setCopied] = useState(false);

  const shareText = verse?.verseText
    ? `${verse.verseText}\n— ${verse.bookName || ''} ${verse.verseNumber || ''}`
    : 'Verse of the Day';

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + window.location.href)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 1rem',
    borderRadius: 10,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    transition: 'all 0.2s',
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-6">
      <span className="text-xs font-semibold mr-1" style={{ color: 'var(--muted)' }}>Share:</span>

      {/* Twitter / X */}
      <button
        onClick={openTwitter}
        style={btnBase}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#FF6B00'; (e.currentTarget as HTMLElement).style.color = '#FF6B00'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
        aria-label="Share on X"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.733-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Post
      </button>

      {/* WhatsApp */}
      <button
        onClick={openWhatsApp}
        style={btnBase}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#25D366'; (e.currentTarget as HTMLElement).style.color = '#25D366'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
        aria-label="Share on WhatsApp"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        WhatsApp
      </button>

      {/* Copy link */}
      <button
        onClick={copyLink}
        style={{ ...btnBase, ...(copied ? { borderColor: '#2D5A27', color: '#2D5A27' } : {}) }}
        aria-label="Copy link"
      >
        {copied ? <Check size={13} /> : <Link2 size={13} />}
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}

function TodayVerseCard({ verse }: { verse: any }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-8"
      style={{
        background: 'linear-gradient(135deg, #C4A882 0%, #D4B896 100%)',
        boxShadow: '0 20px 60px rgba(196,168,130,0.35)',
      }}
    >
      {/* Decorative quote mark */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: -16,
          left: 16,
          fontSize: '9rem',
          lineHeight: 1,
          fontFamily: 'Georgia, serif',
          color: 'rgba(255,107,0,0.18)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        &ldquo;
      </span>

      {verse.bookName && (
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(90,50,10,0.6)' }}>
          {verse.bookName}{verse.verseNumber ? ` · ${verse.verseNumber}` : ''}
        </p>
      )}

      {/* Sanskrit */}
      {verse.verseText && (
        <p
          className="mb-4 leading-loose"
          style={{
            fontFamily: "'Noto Sans Devanagari', sans-serif",
            fontSize: '1.5rem',
            color: '#1A1410',
            lineHeight: 2,
          }}
        >
          {verse.verseText}
        </p>
      )}

      {/* Transliteration */}
      {verse.transliteration && (
        <p className="italic mb-4 text-base" style={{ color: 'rgba(60,30,10,0.7)', lineHeight: 1.7 }}>
          {verse.transliteration}
        </p>
      )}

      {/* Meaning */}
      {(verse.translation || verse.meaning) && (
        <p
          className="text-base leading-relaxed"
          style={{ fontFamily: 'inherit', color: '#2a1a0a' }}
        >
          {verse.translation || verse.meaning}
        </p>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 120,
          height: 120,
          borderRadius: '50% 0 0 0',
          background: 'rgba(0,0,0,0.04)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default function VerseOfDayPage() {
  const [today, setToday] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/verses/of-day/today'),
      api.get('/verses/of-day/history?limit=30').catch(() => ({ data: [] })),
    ])
      .then(([tRes, hRes]) => {
        setToday(tRes.data?.verse || tRes.data);
        setHistory(hRes.data?.history || hRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      {/* ── Header ── */}
      <div
        style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}
        className="py-16"
      >
        <div className="container-site text-center">
          <div className="badge inline-flex items-center gap-1 mb-4">
            <Sparkles size={12} /> Daily Verse
          </div>
          <h1
            className="text-4xl font-black mb-3"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
          >
            Verse of the Day
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* ── Today's verse ── */}
      <div className="container-site py-12">
        <div className="max-w-2xl mx-auto mb-16">
          {loading ? (
            <SkeletonVerse />
          ) : today ? (
            <>
              <TodayVerseCard verse={today} />
              <ShareRow verse={today} />
            </>
          ) : (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
              <Sparkles size={40} className="mx-auto mb-3 opacity-25" />
              <p>No verse selected for today yet.</p>
            </div>
          )}
        </div>

        {/* ── History grid ── */}
        {history.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-8">
              <Calendar size={18} style={{ color: 'var(--accent)' }} />
              <h2
                className="text-xl font-bold"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
              >
                Recent Verses
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item: any) => (
                <div key={item.id || item.date} className="card-hover p-4">
                  {/* Peacock date badge */}
                  {item.date && (
                    <span
                      className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3"
                      style={{ background: 'rgba(0,107,107,0.12)', color: '#006B6B' }}
                    >
                      {format(new Date(item.date), 'MMMM d, yyyy')}
                    </span>
                  )}
                  {item.verse?.verseText && (
                    <p
                      className="line-clamp-2 mb-2 text-sm leading-relaxed"
                      style={{
                        fontFamily: "'Noto Sans Devanagari', sans-serif",
                        color: 'var(--text)',
                      }}
                    >
                      {item.verse.verseText}
                    </p>
                  )}
                  {(item.verse?.translation || item.verse?.meaning) && (
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--muted)' }}>
                      {item.verse.translation || item.verse.meaning}
                    </p>
                  )}
                  {(item.verse?.bookName || item.verse?.verseNumber) && (
                    <span className="badge text-xs mt-2 inline-block">
                      {item.verse.bookName || ''} {item.verse.verseNumber || ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
