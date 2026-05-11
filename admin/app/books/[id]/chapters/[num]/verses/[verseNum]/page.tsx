'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { ArrowLeft, Save, Plus, Trash2, BookOpen, ChevronRight, Mic2, Star } from 'lucide-react';

interface Translation {
  id?: string;
  languageCode: string;
  text: string;
  status: 'draft' | 'published';
}

interface Narration {
  id: string;
  saint?: string;
  language?: string;
  sourceText?: string;
}

interface VerseDetail {
  id: string;
  verseNumber: number | string;
  chapterNumber?: number;
  sanskrit: string;
  transliteration: string;
  categories: string[];
  sampradayas?: { id: string; nameKey: string }[];
  isVerseOfDay?: boolean;
  translations: Translation[];
  narrations?: Narration[];
}

interface Sampraday { id: string; nameKey: string; }

const TRANS_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'sa', label: 'Sanskrit' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'mr', label: 'Marathi' },
];

const CATEGORY_OPTIONS = ['Karma Yoga', 'Jnana Yoga', 'Bhakti Yoga', 'Raja Yoga', 'Dharma', 'Moksha', 'Devotion', 'Wisdom'];

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-10 h-5 rounded-full relative transition-all duration-200 flex-shrink-0"
      style={{ background: checked ? '#4ade80' : 'var(--border-2)' }}>
      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
        style={{ left: checked ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

export default function VerseEditorPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;
  const chapterNum = params.num as string;
  const verseNum = params.verseNum as string;

  const [verse, setVerse] = useState<VerseDetail>({
    id: '', verseNumber: verseNum, sanskrit: '', transliteration: '',
    categories: [], sampradayas: [], isVerseOfDay: false, translations: [],
  });
  const [sampradayas, setSampradayas] = useState<Sampraday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transTab, setTransTab] = useState('en');
  const [showAddNarration, setShowAddNarration] = useState(false);
  const [newNarration, setNewNarration] = useState({ saint: '', language: 'en', sourceText: '' });

  useEffect(() => { fetchData(); }, [bookId, chapterNum, verseNum]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vr, sr] = await Promise.all([
        api.get(`/books/${bookId}/chapters/${chapterNum}/verses/${verseNum}`),
        api.get('/sampradayas'),
      ]);
      const d = vr.data;
      setVerse({
        ...d,
        translations: d.translations || [],
        categories: d.categories || [],
        sampradayas: d.sampradayas || [],
      });
      setSampradayas(Array.isArray(sr.data) ? sr.data : sr.data?.data || []);
    } catch { } finally { setLoading(false); }
  };

  const getTranslation = (code: string): Translation =>
    verse.translations.find(t => t.languageCode === code) || { languageCode: code, text: '', status: 'draft' };

  const setTranslation = (code: string, field: keyof Translation, val: string) => {
    setVerse(v => {
      const existing = v.translations.find(t => t.languageCode === code);
      if (existing) {
        return { ...v, translations: v.translations.map(t => t.languageCode === code ? { ...t, [field]: val } : t) };
      }
      return { ...v, translations: [...v.translations, { languageCode: code, text: '', status: 'draft', [field]: val }] };
    });
  };

  const toggleCategory = (cat: string) => {
    setVerse(v => ({
      ...v,
      categories: v.categories.includes(cat)
        ? v.categories.filter(c => c !== cat)
        : [...v.categories, cat],
    }));
  };

  const toggleSampraday = (id: string) => {
    setVerse(v => {
      const existing = v.sampradayas || [];
      const found = existing.find(s => s.id === id);
      return {
        ...v,
        sampradayas: found ? existing.filter(s => s.id !== id) : [...existing, sampradayas.find(s => s.id === id)!],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id, narrations: _, ...body } = verse as any;
      body.sampradayaIds = (verse.sampradayas || []).map(s => s.id);
      delete body.sampradayas;
      await api.patch(`/verses/${id}`, body);
    } catch { } finally { setSaving(false); }
  };

  const handleAddNarration = async () => {
    try {
      await api.post('/narrations', { ...newNarration, verseId: verse.id });
      setShowAddNarration(false);
      setNewNarration({ saint: '', language: 'en', sourceText: '' });
      fetchData();
    } catch { }
  };

  const handleDeleteNarration = async (nid: string) => {
    try { await api.delete(`/narrations/${nid}`); fetchData(); } catch { }
  };

  const activeTrans = getTranslation(transTab);

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-4 max-w-6xl mx-auto">
            {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <Link href={`/books/${bookId}/chapters/${chapterNum}`}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
              <ArrowLeft size={14} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5 text-xs mb-0.5" style={{ color: 'var(--muted)' }}>
                <Link href="/books" className="hover:opacity-80">Books</Link>
                <ChevronRight size={10} />
                <Link href={`/books/${bookId}`} className="hover:opacity-80">Book</Link>
                <ChevronRight size={10} />
                <Link href={`/books/${bookId}/chapters/${chapterNum}`} className="hover:opacity-80">Ch. {chapterNum}</Link>
                <ChevronRight size={10} />
                <span>Verse {verseNum}</span>
              </div>
              <h1 className="text-xl font-black text-theme">Verse {chapterNum}.{verseNum}</h1>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Verse'}
          </button>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <div className="flex gap-6">

            {/* LEFT — Sanskrit + meta (40%) */}
            <div className="w-2/5 space-y-5 flex-shrink-0">

              {/* Sanskrit */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Sanskrit</label>
                  <textarea
                    value={verse.sanskrit}
                    onChange={e => setVerse(v => ({ ...v, sanskrit: e.target.value }))}
                    rows={4}
                    className="input-field"
                    style={{ fontFamily: 'serif', fontSize: '16px' }}
                    placeholder="Sanskrit verse text…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Transliteration</label>
                  <textarea
                    value={verse.transliteration}
                    onChange={e => setVerse(v => ({ ...v, transliteration: e.target.value }))}
                    rows={3}
                    className="input-field"
                    placeholder="IAST transliteration…"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Categories</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map(cat => {
                    const selected = verse.categories.includes(cat);
                    return (
                      <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
                        style={{
                          background: selected ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-2)',
                          color: selected ? 'var(--accent)' : 'var(--muted)',
                          border: `1px solid ${selected ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border-2)'}`,
                        }}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sampradayas */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Sampradayas</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sampradayas.map(s => {
                    const selected = (verse.sampradayas || []).some(vs => vs.id === s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                        <div onClick={() => toggleSampraday(s.id)}
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all duration-200"
                          style={{
                            background: selected ? 'var(--accent)' : 'var(--surface-2)',
                            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-2)'}`,
                          }}>
                          {selected && <span className="text-[10px] font-bold" style={{ color: 'var(--bg)' }}>✓</span>}
                        </div>
                        <span className="text-sm" style={{ color: selected ? 'var(--text)' : 'var(--muted)' }}>{s.nameKey}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Verse of Day toggle */}
              <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
                style={{
                  background: verse.isVerseOfDay ? 'rgba(245,200,66,0.08)' : 'var(--surface)',
                  border: `1px solid ${verse.isVerseOfDay ? 'rgba(245,200,66,0.25)' : 'var(--border)'}`,
                }}>
                <div className="flex items-center gap-2">
                  <Star size={14} style={{ color: verse.isVerseOfDay ? '#fbbf24' : 'var(--muted)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: verse.isVerseOfDay ? '#fbbf24' : 'var(--text)' }}>
                      Verse of the Day
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Feature on home screen</p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={verse.isVerseOfDay || false}
                  onChange={v => setVerse(prev => ({ ...prev, isVerseOfDay: v }))}
                />
              </div>
            </div>

            {/* RIGHT — Translations (60%) */}
            <div className="flex-1 space-y-5">

              {/* Language tabs */}
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {TRANS_LANGS.map(lang => {
                  const t = getTranslation(lang.code);
                  const hasContent = t.text.length > 0;
                  return (
                    <button key={lang.code} onClick={() => setTransTab(lang.code)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 relative"
                      style={{
                        background: transTab === lang.code ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'transparent',
                        color: transTab === lang.code ? 'var(--bg)' : hasContent ? 'var(--text)' : 'var(--muted)',
                      }}>
                      {lang.label}
                      {hasContent && transTab !== lang.code && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Translation editor */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                    Translation — {TRANS_LANGS.find(l => l.code === transTab)?.label}
                  </label>
                  <textarea
                    value={activeTrans.text}
                    onChange={e => setTranslation(transTab, 'text', e.target.value)}
                    rows={6}
                    className="input-field"
                    placeholder={`Translation text in ${TRANS_LANGS.find(l => l.code === transTab)?.label}…`}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Status</span>
                  <div className="flex gap-2">
                    {(['draft', 'published'] as const).map(s => (
                      <button key={s} type="button"
                        onClick={() => setTranslation(transTab, 'status', s)}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
                        style={{
                          background: activeTrans.status === s
                            ? s === 'published' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)'
                            : 'var(--surface-2)',
                          color: activeTrans.status === s
                            ? s === 'published' ? '#4ade80' : '#fbbf24'
                            : 'var(--muted)',
                          border: `1px solid ${activeTrans.status === s
                            ? s === 'published' ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'
                            : 'var(--border-2)'}`,
                        }}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Narrations */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Mic2 size={14} style={{ color: 'var(--accent)' }} />
                    <span className="font-bold text-theme text-sm">Narrations</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: 'rgba(255,107,43,0.1)', color: 'var(--accent)', border: '1px solid rgba(255,107,43,0.2)' }}>
                      {(verse.narrations || []).length}
                    </span>
                  </div>
                  <button onClick={() => setShowAddNarration(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                    style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                    <Plus size={12} /> Add Narration
                  </button>
                </div>

                {showAddNarration && (
                  <div className="p-5 space-y-3" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,107,43,0.03)' }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>Saint Name</label>
                        <input value={newNarration.saint} onChange={e => setNewNarration(n => ({ ...n, saint: e.target.value }))}
                          className="input-field" placeholder="e.g. Prabhupada" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>Language</label>
                        <select value={newNarration.language} onChange={e => setNewNarration(n => ({ ...n, language: e.target.value }))}
                          className="select-field">
                          {TRANS_LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>Source Citation</label>
                      <input value={newNarration.sourceText} onChange={e => setNewNarration(n => ({ ...n, sourceText: e.target.value }))}
                        className="input-field" placeholder="Book, chapter, page…" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddNarration} className="btn-primary text-xs py-2 px-4">Add</button>
                      <button onClick={() => setShowAddNarration(false)} className="btn-secondary text-xs py-2 px-4">Cancel</button>
                    </div>
                  </div>
                )}

                {(verse.narrations || []).length === 0 && !showAddNarration ? (
                  <div className="py-8 text-center">
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>No narrations linked yet</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {(verse.narrations || []).map(n => (
                      <div key={n.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-theme">{n.saint || 'Unknown Saint'}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {n.language?.toUpperCase()} · {n.sourceText || 'No source'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/narrations/${n.id}`}
                            className="text-xs font-semibold transition-opacity hover:opacity-80"
                            style={{ color: '#60a5fa' }}>
                            Edit
                          </Link>
                          <button onClick={() => handleDeleteNarration(n.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
