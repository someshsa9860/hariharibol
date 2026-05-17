'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  Wand2, Search, Sparkles, Calendar, Image as ImageIcon, X, Check,
  ChevronRight, Bell, RefreshCw,
} from 'lucide-react';

interface VerseOfDay {
  id: string;
  date: string;
  verse: { id: string; sanskrit: string; transliteration: string; meaning: string; reference?: string };
  imageUrl?: string;
  explanation?: string;
  aiGenerated: boolean;
}
interface Config {
  aiProvider: 'gemini' | 'openai' | 'none';
  apiKey?: string;
  autoGenerate: boolean;
  generateImage: boolean;
}
interface Verse { id: string; transliteration: string; sanskrit: string; reference?: string }

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl overflow-hidden`}
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--surface-2)', background: 'var(--surface)' }}>
          <h2 className="font-bold text-theme text-sm">{title}</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
            <X size={15} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function VerseOfDayPage() {
  const [todayVerse,      setTodayVerse]      = useState<VerseOfDay | null>(null);
  const [history,         setHistory]         = useState<VerseOfDay[]>([]);
  const [config,          setConfig]          = useState<Config | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [showSelect,      setShowSelect]      = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchResults,   setSearchResults]   = useState<Verse[]>([]);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [generating,      setGenerating]      = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [sendingPush,     setSendingPush]     = useState(false);
  const [pushSent,        setPushSent]        = useState(false);
  const [aiProvider,      setAiProvider]      = useState<'gemini' | 'openai'>('gemini');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [t, h, c] = await Promise.all([
        api.get('/verses/of-day'),
        api.get('/verses/of-day/history'),
        api.get('/verses/of-day/admin/config'),
      ]);
      setTodayVerse(t.data);
      setHistory(h.data?.data || []);
      setConfig(c.data);
      if (c.data?.aiProvider && c.data.aiProvider !== 'none') setAiProvider(c.data.aiProvider);
    } catch { } finally { setLoading(false); }
  };

  const handleSearchVerses = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await api.get(`/verses?search=${encodeURIComponent(query)}&take=20`);
        setSearchResults(r.data?.data || []);
      } catch { setSearchResults([]); } finally { setSearchLoading(false); }
    }, 350);
  }, []);

  const handleGenerateVerse = async () => {
    setGenerating(true);
    try {
      const r = await api.post('/verses/of-day/admin/generate', { provider: aiProvider });
      setTodayVerse(r.data);
      await fetchData();
    } finally { setGenerating(false); }
  };

  const handleSelectVerse = async (verseId: string) => {
    try {
      const r = await api.post(`/verses/of-day/admin/select/${verseId}`);
      setTodayVerse(r.data);
      setShowSelect(false);
      setSearchQuery('');
      setSearchResults([]);
      await fetchData();
    } catch { }
  };

  const handleGenerateImage = async () => {
    if (!todayVerse) return;
    setGeneratingImage(true);
    try {
      const r = await api.post(`/verses/of-day/admin/generate-image/${todayVerse.verse.id}`);
      setTodayVerse(r.data);
    } finally { setGeneratingImage(false); }
  };

  const handleSendPush = async () => {
    if (!todayVerse) return;
    setSendingPush(true);
    try {
      await api.post('/notifications/verse-of-day', { verseOfDayId: todayVerse.id });
      setPushSent(true);
      setTimeout(() => setPushSent(false), 3000);
    } catch { } finally { setSendingPush(false); }
  };

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Header */}
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Sparkles size={15} style={{ color: '#fbbf24' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Verse of Day</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage daily sacred verse</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSelect(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
              <Search size={14} /> Select Verse
            </button>
            <button onClick={handleGenerateVerse}
              disabled={generating || config?.aiProvider === 'none'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                color: 'var(--bg)',
                boxShadow: '0 4px 15px var(--accent-glow)',
              }}>
              {generating
                ? <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : <Wand2 size={14} />}
              {config?.aiProvider === 'none' ? 'Configure AI' : 'AI Generate'}
            </button>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto space-y-6">

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-72" />
              <Skeleton className="h-28" />
              <Skeleton className="h-52" />
            </div>
          ) : (
            <>
              {/* Today's verse — sandstone card */}
              <div className="rounded-2xl overflow-hidden animate-slide-up relative"
                style={{
                  background: 'linear-gradient(150deg, #5C3317 0%, #7B4A22 25%, #9E6432 55%, #7A4520 100%)',
                  boxShadow: '0 12px 40px rgba(92,51,23,0.55)',
                }}>
                {/* subtle grain overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Crect width=\'1\' height=\'1\' fill=\'%23fff\' opacity=\'0.04\'/%3E%3C/svg%3E")',
                }} />
                <div className="h-1 relative" style={{ background: 'linear-gradient(90deg, #F5C842, #E8932A, #C8784A, transparent)' }} />

                <div className="relative p-7">
                  {/* Date + badges row */}
                  <div className="flex items-start justify-between mb-5 gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#F5C842', opacity: 0.9 }}>
                        Today · {todayLabel}
                      </span>
                      {todayVerse && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          todayVerse.aiGenerated
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/25'
                            : 'bg-green-500/15 text-green-300 border-green-500/25'
                        }`}>
                          {todayVerse.aiGenerated ? '✦ AI Generated' : '✓ Manual'}
                        </span>
                      )}
                    </div>
                    {todayVerse && (
                      <button
                        onClick={handleSendPush}
                        disabled={sendingPush || pushSent}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex-shrink-0 disabled:opacity-60"
                        style={{
                          background: pushSent ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.12)',
                          border: pushSent ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.22)',
                          color: pushSent ? '#4ade80' : '#fff',
                        }}>
                        {sendingPush
                          ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          : pushSent ? <Check size={11} /> : <Bell size={11} />}
                        {pushSent ? 'Sent!' : 'Push to Subscribers'}
                      </button>
                    )}
                  </div>

                  {todayVerse ? (
                    <div className="flex gap-6">
                      <div className="flex-1 min-w-0">
                        {/* Devanagari — large + golden */}
                        <p className="text-3xl mb-2 leading-relaxed font-bold"
                          style={{
                            fontFamily: '"Noto Serif Devanagari", "Mangal", serif',
                            color: '#F5C842',
                            textShadow: '0 2px 12px rgba(245,200,66,0.35)',
                          }}>
                          {todayVerse.verse.sanskrit}
                        </p>

                        {/* Transliteration */}
                        <p className="text-lg font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {todayVerse.verse.transliteration}
                        </p>

                        {todayVerse.verse.reference && (
                          <p className="text-xs mb-3" style={{ color: 'rgba(245,200,66,0.65)' }}>
                            — {todayVerse.verse.reference}
                          </p>
                        )}

                        <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {todayVerse.verse.meaning}
                        </p>

                        {todayVerse.explanation && (
                          <div className="p-4 rounded-xl mb-4"
                            style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(245,200,66,0.18)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#F5C842' }}>AI Insight</p>
                            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{todayVerse.explanation}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button onClick={handleGenerateImage} disabled={generatingImage}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40"
                            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff' }}>
                            {generatingImage
                              ? <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                              : <ImageIcon size={14} />}
                            {todayVerse.imageUrl ? 'Regenerate Image' : 'Generate Image'}
                          </button>
                        </div>
                      </div>

                      {todayVerse.imageUrl && (
                        <div className="w-52 h-52 rounded-2xl overflow-hidden flex-shrink-0"
                          style={{ border: '2px solid rgba(245,200,66,0.3)', boxShadow: '0 8px 28px rgba(0,0,0,0.5)' }}>
                          <img src={todayVerse.imageUrl} alt="Verse art" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-6xl mb-4" style={{ fontFamily: 'serif', opacity: 0.35, color: '#F5C842' }}>ॐ</div>
                      <p className="font-semibold text-white mb-1">No verse set for today</p>
                      <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>Generate with AI or select one manually</p>
                      <div className="flex justify-center gap-3">
                        <button onClick={handleGenerateVerse} disabled={generating || config?.aiProvider === 'none'}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                          style={{ background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.38)', color: '#F5C842' }}>
                          <Wand2 size={14} /> AI Generate
                        </button>
                        <button onClick={() => setShowSelect(true)}
                          className="px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
                          Select Verse
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Generation section */}
              <div className="rounded-2xl overflow-hidden animate-slide-up"
                style={{ animationDelay: '80ms', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Wand2 size={14} style={{ color: 'var(--accent)' }} />
                  <span className="font-bold text-theme text-sm">AI Generation</span>
                </div>
                <div className="p-5 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Provider</label>
                    <select
                      value={aiProvider}
                      onChange={e => setAiProvider(e.target.value as 'gemini' | 'openai')}
                      disabled={config?.aiProvider === 'none'}
                      className="select-field text-sm py-1.5 px-3 rounded-xl"
                      style={{ minWidth: 150 }}>
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI GPT</option>
                    </select>
                  </div>
                  <button
                    onClick={handleGenerateVerse}
                    disabled={generating || config?.aiProvider === 'none'}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                      color: 'var(--bg)',
                      boxShadow: generating ? 'none' : '0 4px 15px var(--accent-glow)',
                    }}>
                    {generating
                      ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> Generating…</>
                      : <><Wand2 size={14} /> Generate Now</>}
                  </button>
                  {config?.aiProvider === 'none' && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      Configure an AI provider in Settings to enable generation.
                    </p>
                  )}
                </div>
              </div>

              {/* History table */}
              {history.length > 0 && (
                <div className="rounded-2xl overflow-hidden animate-slide-up"
                  style={{ animationDelay: '150ms', background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                  <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <Calendar size={14} style={{ color: '#fbbf24' }} />
                    <span className="font-bold text-theme text-sm">History</span>
                    <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                      {history.length} entries
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th className="table-header">Date</th>
                          <th className="table-header">Verse</th>
                          <th className="table-header">Source</th>
                          <th className="table-header">Image</th>
                          <th className="table-header">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.slice(0, 10).map(item => (
                          <tr key={item.id} className="table-row">
                            <td className="table-cell" style={{ minWidth: 120 }}>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                                  {new Date(item.date).getDate()}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-theme">
                                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </p>
                                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                                    {new Date(item.date).getFullYear()}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="table-cell" style={{ maxWidth: 260 }}>
                              <p className="text-sm font-medium text-theme truncate">{item.verse.transliteration}</p>
                              <p className="text-xs truncate mt-0.5"
                                style={{ fontFamily: '"Noto Serif Devanagari", serif', color: '#fbbf24', opacity: 0.7 }}>
                                {item.verse.sanskrit}
                              </p>
                            </td>
                            <td className="table-cell">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                item.aiGenerated
                                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                                  : 'bg-green-500/15 text-green-400 border-green-500/25'
                              }`}>
                                {item.aiGenerated ? '✦ AI' : '✓ Manual'}
                              </span>
                            </td>
                            <td className="table-cell">
                              {item.imageUrl ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden"
                                  style={{ border: '1px solid var(--border-2)' }}>
                                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>—</span>
                              )}
                            </td>
                            <td className="table-cell">
                              <button
                                onClick={() => handleSelectVerse(item.verse.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150"
                                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
                                <RefreshCw size={10} /> Use Again
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Select Verse Modal */}
        {showSelect && (
          <Modal
            title="Select Verse of Day"
            onClose={() => { setShowSelect(false); setSearchQuery(''); setSearchResults([]); }}
            wide>
            <div className="space-y-4">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Search transliteration, Sanskrit, or meaning…"
                  value={searchQuery}
                  onChange={e => handleSearchVerses(e.target.value)}
                  className="input-field pl-10 text-sm"
                  autoFocus
                />
                {searchLoading && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                )}
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {searchResults.length > 0 ? searchResults.map(verse => (
                  <button key={verse.id} onClick={() => handleSelectVerse(verse.id)}
                    className="w-full text-left px-4 py-3 rounded-xl transition-all duration-150 flex items-start gap-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,43,0.2)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--surface-2)';
                    }}>
                    <ChevronRight size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-theme truncate">{verse.transliteration}</p>
                      <p className="text-sm mt-0.5"
                        style={{ fontFamily: '"Noto Serif Devanagari", serif', color: '#fbbf24', opacity: 0.8 }}>
                        {verse.sanskrit}
                      </p>
                      {verse.reference && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>— {verse.reference}</p>
                      )}
                    </div>
                  </button>
                )) : searchQuery.length > 0 && !searchLoading ? (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>No matching verses found</p>
                ) : (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>Type to search all verses…</p>
                )}
              </div>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}
