'use client';

import { useState, useEffect } from 'react';
import { Edit3, BookOpen, Music, Heart, Star } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';
import { useAppStore } from '@/lib/store';

const PLACEHOLDER_VERSES = [
  { id: '1', verseText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।', translation: 'You have a right to perform your duties but not to the fruits thereof.', verseNumber: '2.47', bookName: 'Bhagavad Gita' },
  { id: '2', verseText: 'योगस्थः कुरु कर्माणि', translation: 'Be steadfast in yoga and perform your actions without attachment.', verseNumber: '2.48', bookName: 'Bhagavad Gita' },
];
const PLACEHOLDER_MANTRAS = [
  { id: '1', name: 'Gayatri Mantra', category: 'Vedic', text: 'ॐ भूर्भुवः स्वः तत्सवितुर्वरेण्यम्' },
  { id: '2', name: 'Maha Mrityunjaya', category: 'Shaiva', text: 'ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्' },
];
const PLACEHOLDER_STATS = { versesRead: 42, mantrasChanted: 108, sampradayasFollowed: 3 };

const STAT_CONFIG = [
  { key: 'versesRead',           label: 'Verses Read',         color: '#C75A1A', Icon: BookOpen },
  { key: 'mantrasChanted',       label: 'Mantras Chanted',     color: '#006B6B', Icon: Music   },
  { key: 'sampradayasFollowed',  label: 'Sampradayas',         color: '#2D5A27', Icon: Star    },
] as const;

const TABS = [
  { key: 'verses'  as const, label: 'Favorite Verses', Icon: Heart },
  { key: 'mantras' as const, label: 'Saved Mantras',   Icon: Music },
];

function EmptyTabState({ Icon, text }: { Icon: React.ElementType; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
      <Icon size={36} style={{ marginBottom: '0.75rem', opacity: 0.35, display: 'block', margin: '0 auto 0.75rem' }} />
      <p style={{ fontSize: '0.875rem' }}>{text}</p>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAppStore((s) => s.user);
  const [stats]   = useState(PLACEHOLDER_STATS);
  const [verses,  setVerses]  = useState<any[]>([]);
  const [mantras, setMantras] = useState<any[]>([]);
  const [tab,     setTab]     = useState<'verses' | 'mantras'>('verses');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/users/favorites/verses'),
      api.get('/users/favorites/mantras'),
    ]).then(([vRes, mRes]) => {
      setVerses(vRes.status === 'fulfilled'
        ? (vRes.value.data?.data ?? vRes.value.data ?? PLACEHOLDER_VERSES)
        : PLACEHOLDER_VERSES);
      setMantras(mRes.status === 'fulfilled'
        ? (mRes.value.data?.data ?? mRes.value.data ?? PLACEHOLDER_MANTRAS)
        : PLACEHOLDER_MANTRAS);
    }).finally(() => setLoading(false));
  }, []);

  const displayName = user?.displayName || 'Spiritual Seeker';
  const initials    = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Profile" />

      <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: '5rem' }}>
        {/* Hero — saffron-to-maroon gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #FF6B00, #7B1C1C)',
          padding: '2.5rem 1.5rem 3rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
        }}>
          {/* Avatar with gold ring */}
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={displayName} style={{
              width: 90, height: 90, borderRadius: '50%', objectFit: 'cover',
              border: '4px solid #D4A055', boxShadow: '0 0 0 6px rgba(212,160,85,0.28)',
            }} />
          ) : (
            <div style={{
              width: 90, height: 90, borderRadius: '50%',
              background: 'linear-gradient(135deg, #D4A055, #B07830)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 700, color: '#fff',
              fontFamily: '"Playfair Display", Georgia, serif',
              border: '4px solid #D4A055', boxShadow: '0 0 0 6px rgba(212,160,85,0.28)',
            }}>{initials}</div>
          )}

          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: 4,
            }}>{displayName}</h1>
            {user?.email && (
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem' }}>{user.email}</p>
            )}
          </div>

          {/* Edit profile — saffron button */}
          <button style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 22px', borderRadius: 20,
            background: 'rgba(255,255,255,0.15)',
            border: '1.5px solid rgba(255,255,255,0.32)',
            color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            backdropFilter: 'blur(8px)', transition: 'background 0.15s',
          }}>
            <Edit3 size={14} /> Edit Profile
          </button>
        </div>

        {/* Stats row — three colored badges */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px', background: 'var(--border)',
          borderBottom: '1px solid var(--border)',
        }}>
          {STAT_CONFIG.map(({ key, label, color, Icon }) => (
            <div key={key} style={{ padding: '1.25rem 0.5rem', textAlign: 'center', background: 'var(--bg)' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10, marginBottom: 6,
                background: `${color}18`,
              }}>
                <Icon size={16} color={color} />
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 3 }}>
                {stats[key]}
              </p>
              <p style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        <div style={{ padding: '1.5rem 1rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setTab(key)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
                background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === key ? '#FF6B00' : 'transparent'}`,
                marginBottom: -1,
                color: tab === key ? '#FF6B00' : 'var(--muted)',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: tab === key ? 700 : 500,
                transition: 'color 0.15s', outline: 'none',
              }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[0, 1].map((i) => (
                <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
              ))}
            </div>
          ) : tab === 'verses' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {verses.length === 0 ? (
                <EmptyTabState Icon={Heart} text="No favorite verses yet. Start exploring!" />
              ) : verses.map((v, i) => (
                <div key={v.id || i} className="verse-card" style={{ cursor: 'pointer' }}>
                  {v.verseText && (
                    <p style={{
                      fontFamily: '"Noto Sans Devanagari", serif',
                      fontSize: '0.95rem', lineHeight: 2, color: 'var(--text)', marginBottom: 4,
                    }}>{v.verseText}</p>
                  )}
                  {v.translation && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 8 }}>
                      {v.translation}
                    </p>
                  )}
                  <span className="badge">{v.bookName} · {v.verseNumber}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {mantras.length === 0 ? (
                <EmptyTabState Icon={Music} text="No saved mantras yet. Explore the mantra library!" />
              ) : mantras.map((m, i) => (
                <div key={m.id || i} className="card" style={{ padding: '1rem 1.125rem', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <h3 style={{
                      fontFamily: '"Playfair Display", Georgia, serif',
                      fontSize: '1rem', fontWeight: 700, color: 'var(--text)',
                    }}>{m.name}</h3>
                    {m.category && <span className="badge">{m.category}</span>}
                  </div>
                  {m.text && (
                    <p style={{
                      fontFamily: '"Noto Sans Devanagari", serif',
                      fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 2,
                    }}>{m.text}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
