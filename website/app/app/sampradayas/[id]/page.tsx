'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users, Music2, BookOpen } from 'lucide-react';
import api from '@/lib/api';

export default function SampradayaDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [sampradaya, setSampradaya] = useState<any>(null);
  const [verses, setVerses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [mantras, setMantras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/sampradayas/${id}`).catch(() => ({ data: null })),
      api.get(`/sampradayas/${id}/verses?take=6`).catch(() => ({ data: [] })),
      api.get(`/groups?sampradayaId=${id}&take=8`).catch(() => ({ data: [] })),
      api.get(`/mantras?sampradayaId=${id}&take=10`).catch(() => ({ data: [] })),
    ]).then(([sRes, vRes, gRes, mRes]) => {
      const s = sRes.data?.data || sRes.data;
      setSampradaya(s);
      setFollowing(s?.isFollowing ?? false);
      setVerses(vRes.data?.data || vRes.data || []);
      setGroups(gRes.data?.data || gRes.data || []);
      setMantras(mRes.data?.data || mRes.data || []);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleFollow = async () => {
    setToggling(true);
    try {
      if (following) {
        await api.delete(`/sampradayas/${id}/follow`);
        setFollowing(false);
        setSampradaya((prev: any) => prev ? { ...prev, followerCount: (prev.followerCount ?? 1) - 1 } : prev);
      } else {
        await api.post(`/sampradayas/${id}/follow`);
        setFollowing(true);
        setSampradaya((prev: any) => prev ? { ...prev, followerCount: (prev.followerCount ?? 0) + 1 } : prev);
      }
    } catch {}
    setToggling(false);
  };

  const handleGroupToggle = async (group: any) => {
    setJoiningGroup(group.id);
    try {
      if (group.isJoined) {
        await api.delete(`/groups/${group.id}/members`);
        setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, isJoined: false } : g));
      } else {
        await api.post(`/groups/${group.id}/members`);
        setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, isJoined: true } : g));
      }
    } catch {}
    setJoiningGroup(null);
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <div className="animate-pulse" style={{ height: 320, background: 'var(--surface-2)' }} />
        <div className="p-5 space-y-4 max-w-2xl mx-auto">
          <div className="skeleton h-6 w-1/2" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-28 rounded-2xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const coverImg = sampradaya?.heroImageUrl || sampradaya?.thumbnailUrl;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 88 }}>
      {/* Hero banner */}
      <div className="relative w-full overflow-hidden" style={{ height: 320 }}>
        {coverImg ? (
          <img
            src={coverImg}
            alt={sampradaya?.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #7B1C1C 0%, #A52626 50%, #FF6B00 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'Noto Sans Devanagari, serif',
                fontSize: 80,
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1,
              }}
            >
              ॐ
            </span>
          </div>
        )}

        {/* Dark gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.12) 100%)',
          }}
        />

        {/* Back button */}
        <Link
          href="/sampradayas"
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: 'rgba(0,0,0,0.38)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            textDecoration: 'none',
          }}
        >
          <ChevronLeft size={13} /> Sampradayas
        </Link>

        {/* Title & follow */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          <h1
            style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 900,
              fontSize: 'clamp(1.6rem, 6vw, 2.6rem)',
              color: '#fff',
              lineHeight: 1.15,
              textShadow: '0 2px 14px rgba(0,0,0,0.4)',
              marginBottom: 6,
            }}
          >
            {sampradaya?.name || 'Sampradaya'}
          </h1>
          {(sampradaya?.followerCount ?? 0) > 0 && (
            <p
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.72)',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Users size={13} />
              {(sampradaya.followerCount).toLocaleString()} followers
            </p>
          )}
          <button
            onClick={handleFollow}
            disabled={toggling}
            style={{
              background: following ? 'rgba(255,255,255,0.18)' : 'var(--saffron)',
              color: '#fff',
              border: following ? '1.5px solid rgba(255,255,255,0.35)' : 'none',
              borderRadius: 30,
              padding: '10px 28px',
              fontSize: 14,
              fontWeight: 700,
              cursor: toggling ? 'not-allowed' : 'pointer',
              opacity: toggling ? 0.65 : 1,
              backdropFilter: following ? 'blur(8px)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {following ? '✓ Following' : '+ Follow'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-7 max-w-2xl mx-auto">
        {/* About section */}
        {sampradaya?.description && (
          <section>
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--text)',
                marginBottom: 10,
              }}
            >
              About
            </h2>
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(196,168,130,0.12), rgba(196,168,130,0.22))',
                border: '1px solid rgba(196,168,130,0.3)',
                borderLeft: '4px solid var(--peacock)',
                borderRadius: 14,
                padding: '18px 20px',
              }}
            >
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.85 }}>
                {sampradaya.description}
              </p>
              {sampradaya.founder && (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginTop: 10,
                    fontStyle: 'italic',
                  }}
                >
                  Founded by {sampradaya.founder}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Linked Verses */}
        {verses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <BookOpen size={16} style={{ color: 'var(--peacock)' }} />
                Sacred Verses
              </h2>
              <span
                className="text-xs font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                {verses.length} verses
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {verses.map((v: any) => (
                <div
                  key={v.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(196,168,130,0.10), rgba(196,168,130,0.20))',
                    border: '1px solid rgba(196,168,130,0.28)',
                    borderRadius: 14,
                    padding: '14px 16px',
                  }}
                >
                  {v.verseText && (
                    <p
                      style={{
                        fontFamily: 'Noto Sans Devanagari, serif',
                        fontSize: 13,
                        color: 'var(--text)',
                        lineHeight: 1.9,
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
                  {v.translation && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--muted)',
                        lineHeight: 1.55,
                        marginBottom: 8,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {v.translation}
                    </p>
                  )}
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: 'rgba(199,90,26,0.12)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(199,90,26,0.2)',
                    }}
                  >
                    {v.bookName || v.book?.title} {v.verseNumber}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Community Groups */}
        {groups.length > 0 && (
          <section>
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--text)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Users size={16} style={{ color: 'var(--peacock)' }} />
              Community Groups
            </h2>
            <div className="space-y-3">
              {groups.map((g: any) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-2xl p-3"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'var(--gradient-sacred)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Users size={20} style={{ color: '#fff' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/groups/${g.id}`} style={{ textDecoration: 'none' }}>
                      <p
                        className="font-bold text-sm truncate"
                        style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
                      >
                        {g.name}
                      </p>
                    </Link>
                    {g.memberCount != null && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {g.memberCount.toLocaleString()} members
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleGroupToggle(g)}
                    disabled={joiningGroup === g.id}
                    className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: g.isJoined ? 'var(--surface-2)' : 'var(--saffron)',
                      color: g.isJoined ? 'var(--muted)' : '#fff',
                      border: g.isJoined ? '1px solid var(--border-2)' : 'none',
                      opacity: joiningGroup === g.id ? 0.55 : 1,
                      cursor: joiningGroup === g.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {g.isJoined ? 'Joined' : 'Join'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related Mantras */}
        {mantras.length > 0 && (
          <section>
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--text)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Music2 size={16} style={{ color: 'var(--accent-2)' }} />
              Related Mantras
            </h2>
            <div
              style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                paddingBottom: 6,
                scrollbarWidth: 'none',
              }}
            >
              {mantras.map((m: any) => (
                <div
                  key={m.id}
                  style={{
                    minWidth: 160,
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(212,160,85,0.12), rgba(199,90,26,0.14))',
                    border: '1px solid rgba(212,160,85,0.28)',
                    borderRadius: 14,
                    padding: '14px 14px',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'var(--gradient-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <Music2 size={16} style={{ color: '#fff' }} />
                  </div>
                  <p
                    style={{
                      fontFamily: 'Playfair Display, serif',
                      fontWeight: 700,
                      fontSize: 12,
                      color: 'var(--text)',
                      lineHeight: 1.35,
                      marginBottom: 4,
                    }}
                  >
                    {m.name || m.title}
                  </p>
                  {m.category && (
                    <p style={{ fontSize: 10, color: 'var(--muted)' }}>{m.category}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state when no related content */}
        {!loading && verses.length === 0 && groups.length === 0 && mantras.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <div
              style={{
                fontFamily: 'Noto Sans Devanagari, serif',
                fontSize: 52,
                opacity: 0.15,
                marginBottom: 14,
                color: 'var(--maroon)',
              }}
            >
              ॐ
            </div>
            <p className="text-sm">Content for this tradition is being added soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
