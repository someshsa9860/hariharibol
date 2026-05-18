'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Search, BookOpen, Music2, Bookmark, X, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

const BOOK_GRADIENTS = [
  'linear-gradient(135deg, #FF6B00, #D4A055)',
  'linear-gradient(135deg, #006B6B, #2D5A27)',
  'linear-gradient(135deg, #7B1C1C, #E8A0A0)',
  'linear-gradient(135deg, #D4A055, #C75A1A)',
];

type Tab = 'verses' | 'mantras' | 'books';

interface VerseResult {
  id: string;
  verseText?: string;
  transliteration?: string;
  translation?: string;
  verseNumber?: string;
  bookName?: string;
}

interface MantraResult {
  id: string;
  name: string;
  meaning?: string;
  deity?: string;
  category?: string;
}

interface BookResult {
  id: string;
  title: string;
  author?: string;
  _count?: { chapters: number };
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        borderRadius: 14,
        padding: '1rem',
        border: '1px solid var(--border)',
      }}
    >
      <div className="skeleton h-4 w-3/4 mb-3" />
      <div className="skeleton h-3 w-full mb-2" />
      <div className="skeleton h-3 w-1/2" />
    </div>
  );
}

export default function SearchPage() {
  const { user } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('verses');
  const [loading, setLoading] = useState(false);
  const [verses, setVerses] = useState<VerseResult[]>([]);
  const [mantras, setMantras] = useState<MantraResult[]>([]);
  const [books, setBooks] = useState<BookResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hhb_recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const saveRecentSearch = (q: string) => {
    if (!q.trim()) return;
    setRecentSearches((prev) => {
      const updated = [q, ...prev.filter((s) => s !== q)].slice(0, 8);
      try {
        localStorage.setItem('hhb_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setVerses([]);
      setMantras([]);
      setBooks([]);
      return;
    }
    setLoading(true);
    try {
      const [vRes, mRes, bRes] = await Promise.allSettled([
        api.get(`/verses?search=${encodeURIComponent(q)}&take=20`),
        api.get(`/mantras?search=${encodeURIComponent(q)}&take=20`),
        api.get(`/books?search=${encodeURIComponent(q)}&take=20`),
      ]);
      setVerses(vRes.status === 'fulfilled' ? (vRes.value.data?.data || vRes.value.data || []) : []);
      setMantras(mRes.status === 'fulfilled' ? (mRes.value.data?.data || mRes.value.data || []) : []);
      setBooks(bRes.status === 'fulfilled' ? (bRes.value.data?.data || bRes.value.data || []) : []);
      saveRecentSearch(q);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const clearQuery = () => {
    setQuery('');
    setVerses([]);
    setMantras([]);
    setBooks([]);
    inputRef.current?.focus();
  };

  const removeRecent = (s: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((r) => r !== s);
      try {
        localStorage.setItem('hhb_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searched = query.trim().length > 0;
  const hasResults = verses.length > 0 || mantras.length > 0 || books.length > 0;
  const tabCounts: Record<Tab, number> = { verses: verses.length, mantras: mantras.length, books: books.length };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 88 }}>
      {/* Search header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(199,90,26,0.08), rgba(0,107,107,0.06))',
          borderBottom: '1px solid var(--border)',
          padding: '24px 20px 20px',
        }}
      >
        <h1
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.4rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          Search
        </h1>

        <div style={{ position: 'relative', maxWidth: 640 }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--saffron)',
              pointerEvents: 'none',
            }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search verses, mantras, books..."
            className="input-field"
            style={{ paddingLeft: 44, paddingRight: query ? 40 : 14, height: 48, fontSize: 15 }}
          />
          {query && (
            <button
              onClick={clearQuery}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: 4,
                borderRadius: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          <kbd
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            ⌘K
          </kbd>{' '}
          /{' '}
          <kbd
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            Ctrl+K
          </kbd>{' '}
          to focus search from anywhere
        </p>
      </div>

      {/* Tab bar */}
      {(searched || hasResults) && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {(['verses', 'mantras', 'books'] as Tab[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 20,
                  border: active ? '2px solid var(--saffron)' : '2px solid var(--border)',
                  background: active ? 'rgba(255,107,0,0.09)' : 'transparent',
                  color: active ? 'var(--saffron)' : 'var(--muted)',
                  fontWeight: active ? 700 : 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tabCounts[tab] > 0 && (
                  <span
                    style={{
                      background: 'var(--peacock)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '1px 7px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {tabCounts[tab]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-5 max-w-2xl mx-auto">
        {/* Recent searches */}
        {!searched && recentSearches.length > 0 && (
          <div>
            <p
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: 'var(--muted)' }}
            >
              Recent Searches
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentSearches.map((s) => (
                <div
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Clock size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  <span
                    style={{ flex: 1, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}
                    onClick={() => handleQueryChange(s)}
                  >
                    {s}
                  </span>
                  <button
                    onClick={() => removeRecent(s)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 4,
                      color: 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty landing state */}
        {!searched && recentSearches.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 64 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(199,90,26,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Search size={28} style={{ color: 'var(--saffron)' }} />
            </div>
            <p
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--text)',
                marginBottom: 6,
              }}
            >
              Search the Sacred Texts
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
              Find verses, mantras, and books from
              <br />
              the Vedic tradition
            </p>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* No results */}
        {searched && !loading && !hasResults && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div
              style={{
                fontSize: 52,
                lineHeight: 1,
                marginBottom: 16,
                fontFamily: 'Noto Sans Devanagari, serif',
                opacity: 0.35,
              }}
            >
              ॐ
            </div>
            <p
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 700,
                fontSize: '1rem',
                color: 'var(--text)',
                marginBottom: 6,
              }}
            >
              No results for &ldquo;{query}&rdquo;
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Try a different search term or browse the categories
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && hasResults && (
          <>
            {/* Verses tab */}
            {activeTab === 'verses' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {verses.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
                    No verse results for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  verses.map((v) => (
                    <Link key={v.id} href={`/books`} style={{ textDecoration: 'none' }}>
                      <div
                        className="card-hover"
                        style={{
                          background: 'linear-gradient(135deg, rgba(196,168,130,0.09), rgba(196,168,130,0.15))',
                          border: '1px solid rgba(196,168,130,0.3)',
                          borderRadius: 14,
                          padding: '1rem',
                        }}
                      >
                        {v.verseText && (
                          <p
                            style={{
                              fontFamily: 'Noto Sans Devanagari, serif',
                              fontSize: '0.95rem',
                              lineHeight: 1.9,
                              color: 'var(--text)',
                              marginBottom: 8,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {v.verseText}
                          </p>
                        )}
                        {v.transliteration && (
                          <p
                            style={{
                              fontStyle: 'italic',
                              color: 'var(--muted)',
                              fontSize: 12,
                              marginBottom: 8,
                              lineHeight: 1.6,
                            }}
                          >
                            {v.transliteration.split('\n')[0]}
                          </p>
                        )}
                        <div
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(196,168,130,0.2)',
                              color: 'var(--accent-2)',
                              borderColor: 'rgba(196,168,130,0.4)',
                            }}
                          >
                            {v.bookName} {v.verseNumber}
                          </span>
                          {user && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                toggleFav(v.id);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 6,
                                borderRadius: 8,
                                color: favorites.has(v.id) ? 'var(--saffron)' : 'var(--muted)',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              title={favorites.has(v.id) ? 'Remove bookmark' : 'Bookmark'}
                            >
                              <Bookmark
                                size={15}
                                fill={favorites.has(v.id) ? 'currentColor' : 'none'}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Mantras tab */}
            {activeTab === 'mantras' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mantras.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
                    No mantra results for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  mantras.map((m) => (
                    <Link key={m.id} href={`/mantras`} style={{ textDecoration: 'none' }}>
                      <div
                        className="card-hover"
                        style={{
                          background: 'linear-gradient(135deg, rgba(0,107,107,0.06), rgba(45,90,39,0.09))',
                          border: '1px solid rgba(0,107,107,0.2)',
                          borderRadius: 14,
                          padding: '1rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            marginBottom: m.meaning ? 8 : 0,
                          }}
                        >
                          <p
                            style={{
                              fontFamily: 'Playfair Display, serif',
                              fontWeight: 700,
                              fontSize: '1rem',
                              color: 'var(--text)',
                            }}
                          >
                            {m.name}
                          </p>
                          {(m.deity || m.category) && (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(0,107,107,0.12)',
                                color: 'var(--peacock)',
                                borderColor: 'rgba(0,107,107,0.25)',
                                flexShrink: 0,
                                marginLeft: 8,
                              }}
                            >
                              {m.deity || m.category}
                            </span>
                          )}
                        </div>
                        {m.meaning && (
                          <p
                            style={{
                              color: 'var(--text-2)',
                              fontSize: 13,
                              lineHeight: 1.7,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {m.meaning}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Books tab */}
            {activeTab === 'books' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {books.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
                    No book results for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  books.map((b, i) => (
                    <Link key={b.id} href={`/books/${b.id}`} style={{ textDecoration: 'none' }}>
                      <div
                        className="card-hover"
                        style={{ display: 'flex', alignItems: 'center', gap: 14, borderRadius: 14, padding: '1rem' }}
                      >
                        <div
                          style={{
                            width: 52,
                            height: 68,
                            borderRadius: 8,
                            flexShrink: 0,
                            background: BOOK_GRADIENTS[i % BOOK_GRADIENTS.length],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BookOpen size={20} style={{ color: '#fff' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontFamily: 'Playfair Display, serif',
                              fontWeight: 700,
                              fontSize: '0.95rem',
                              color: 'var(--text)',
                              marginBottom: 4,
                            }}
                          >
                            {b.title}
                          </p>
                          {b.author && (
                            <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>
                              {b.author}
                            </p>
                          )}
                          {b._count?.chapters != null && (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(0,107,107,0.10)',
                                color: 'var(--peacock)',
                                borderColor: 'rgba(0,107,107,0.2)',
                              }}
                            >
                              {b._count.chapters} chapters
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
