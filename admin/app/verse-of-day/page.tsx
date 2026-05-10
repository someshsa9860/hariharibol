'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Wand2, Search, Settings, Sparkles, Calendar, Image as ImageIcon, X, Check, ChevronRight } from 'lucide-react';

interface VerseOfDay {
  id: string;
  date: string;
  verse: { id: string; sanskrit: string; transliteration: string; meaning: string; };
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
interface Verse { id: string; transliteration: string; sanskrit: string; }

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
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

export default function VerseOfDayPage() {
  const [todayVerse,      setTodayVerse]      = useState<VerseOfDay | null>(null);
  const [history,         setHistory]         = useState<VerseOfDay[]>([]);
  const [config,          setConfig]          = useState<Config | null>(null);
  const [verses,          setVerses]          = useState<Verse[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [showConfig,      setShowConfig]      = useState(false);
  const [showSelect,      setShowSelect]      = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [generating,      setGenerating]      = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [localConfig,     setLocalConfig]     = useState<Config | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [t, h, c, v] = await Promise.all([
        api.get('/verses/of-day'),
        api.get('/verses/of-day/history'),
        api.get('/verses/of-day/admin/config'),
        api.get('/verses'),
      ]);
      setTodayVerse(t.data);
      setHistory(h.data?.data || []);
      setConfig(c.data); setLocalConfig(c.data);
      setVerses(v.data?.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleSaveConfig = async () => {
    if (!localConfig) return;
    try {
      const r = await api.patch('/verses/of-day/admin/config', localConfig);
      setConfig(r.data); setShowConfig(false);
    } catch { }
  };

  const handleGenerateVerse = async () => {
    setGenerating(true);
    try { const r = await api.post('/verses/of-day/admin/generate'); setTodayVerse(r.data); await fetchData(); }
    finally { setGenerating(false); }
  };

  const handleSelectVerse = async (verseId: string) => {
    try { const r = await api.post(`/verses/of-day/admin/select/${verseId}`); setTodayVerse(r.data); setShowSelect(false); await fetchData(); }
    catch { }
  };

  const handleGenerateImage = async () => {
    if (!todayVerse) return;
    setGeneratingImage(true);
    try { const r = await api.post(`/verses/of-day/admin/generate-image/${todayVerse.verse.id}`); setTodayVerse(r.data); }
    finally { setGeneratingImage(false); }
  };

  const filteredVerses = verses.filter(v =>
    v.transliteration.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.sanskrit.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <button onClick={() => setShowConfig(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
              <Settings size={14} /> Config
            </button>
            <button onClick={() => setShowSelect(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: 'var(--border)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
              <Search size={14} /> Select
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
              <Skeleton className="h-56" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <>
              {/* Today's verse card */}
              {todayVerse ? (
                <div className="rounded-2xl overflow-hidden animate-slide-up relative"
                  style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent) 0%, color-mix(in srgb, var(--accent-2) 5%, transparent) 100%)',
                    border: '1px solid rgba(255,107,43,0.2)',
                    boxShadow: '0 8px 32px var(--accent-glow)',
                  }}>
                  {/* Top accent line */}
                  <div className="h-0.5" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2), transparent)' }} />

                  <div className="p-6 flex gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                          Today · {new Date(todayVerse.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </span>
                        <span className={`badge ${todayVerse.aiGenerated ? 'badge-blue' : 'badge-green'}`}>
                          {todayVerse.aiGenerated ? '✦ AI Generated' : '✓ Manual'}
                        </span>
                        {todayVerse.imageUrl && <span className="badge badge-amber">🖼 Image</span>}
                      </div>

                      <p className="text-2xl font-black text-theme mb-2 leading-snug">{todayVerse.verse.transliteration}</p>
                      <p className="text-base mb-3" style={{ fontFamily: 'serif', color: '#fbbf24', opacity: 0.9 }}>{todayVerse.verse.sanskrit}</p>
                      <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>{todayVerse.verse.meaning}</p>

                      {todayVerse.explanation && (
                        <div className="p-4 rounded-xl mb-4"
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#fbbf24' }}>AI Insight</p>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', opacity: 0.8 }}>{todayVerse.explanation}</p>
                        </div>
                      )}

                      {!todayVerse.imageUrl && config?.generateImage && (
                        <button onClick={handleGenerateImage} disabled={generatingImage}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40"
                          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                          {generatingImage
                            ? <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            : <ImageIcon size={14} />}
                          Generate Image
                        </button>
                      )}
                    </div>

                    {todayVerse.imageUrl && (
                      <div className="w-44 h-44 rounded-2xl overflow-hidden flex-shrink-0"
                        style={{ border: '1px solid var(--border-2)' }}>
                        <img src={todayVerse.imageUrl} alt="Verse art" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl p-12 text-center"
                  style={{ background: 'var(--surface)', border: '1px dashed rgba(255,107,43,0.2)' }}>
                  <div className="text-5xl mb-4 opacity-30" style={{ fontFamily: 'serif' }}>ॐ</div>
                  <p className="font-semibold text-theme mb-1">No verse set for today</p>
                  <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>Generate with AI or select one manually</p>
                  <div className="flex justify-center gap-3">
                    <button onClick={handleGenerateVerse} disabled={generating || config?.aiProvider === 'none'}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)' }}>
                      <Wand2 size={14} /> AI Generate
                    </button>
                    <button onClick={() => setShowSelect(true)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                      Select Verse
                    </button>
                  </div>
                </div>
              )}

              {/* History */}
              {history.length > 0 && (
                <div className="rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
                  <div className="px-6 py-4 flex items-center gap-2"
                    style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', border: '1px solid var(--surface-2)', borderRadius: '16px 16px 0 0' }}>
                    <Calendar size={14} style={{ color: '#fbbf24' }} />
                    <span className="font-bold text-theme text-sm">Recent History</span>
                  </div>
                  <div style={{ border: '1px solid var(--surface-2)', borderTop: 'none', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                    {history.slice(0, 8).map((item, i) => (
                      <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-150"
                        style={{
                          borderBottom: i < 7 ? '1px solid var(--border)' : 'none',
                          background: 'transparent',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                          {new Date(item.date).getDate()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-theme truncate">{item.verse.transliteration}</p>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.imageUrl && <span className="badge badge-amber text-[10px]">🖼</span>}
                          <span className={`badge text-[10px] ${item.aiGenerated ? 'badge-blue' : 'badge-green'}`}>
                            {item.aiGenerated ? 'AI' : 'Manual'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Config Modal */}
        {showConfig && localConfig && (
          <Modal title="AI Configuration" onClose={() => setShowConfig(false)}>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>AI Provider</label>
                <select value={localConfig.aiProvider}
                  onChange={e => setLocalConfig(p => ({ ...p!, aiProvider: e.target.value as any }))}
                  className="select-field">
                  <option value="none">None — Manual Only</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>

              {localConfig.aiProvider !== 'none' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>API Key</label>
                  <input type="password" placeholder="Enter API key…" className="input-field"
                    onBlur={e => e.target.value && setLocalConfig(p => ({ ...p!, apiKey: e.target.value }))} />
                </div>
              )}

              <div className="flex items-center justify-between py-3 px-4 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div>
                  <p className="text-sm font-semibold text-theme">Auto-generate daily</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Automatically pick a verse every morning</p>
                </div>
                <ToggleSwitch checked={localConfig.autoGenerate}
                  onChange={v => setLocalConfig(p => ({ ...p!, autoGenerate: v }))} />
              </div>

              <div className="flex items-center justify-between py-3 px-4 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div>
                  <p className="text-sm font-semibold text-theme">Generate verse image</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Create spiritual artwork using AI</p>
                </div>
                <ToggleSwitch checked={localConfig.generateImage}
                  onChange={v => setLocalConfig(p => ({ ...p!, generateImage: v }))} />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={handleSaveConfig}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)' }}>
                  <Check size={14} /> Save Configuration
                </button>
                <button onClick={() => setShowConfig(false)} className="btn-secondary py-2.5 px-5 text-sm">Cancel</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Select Verse Modal */}
        {showSelect && (
          <Modal title="Select Verse of Day" onClose={() => setShowSelect(false)}>
            <div className="space-y-4">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                <input type="text" placeholder="Search verses…" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field pl-10 text-sm" autoFocus />
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {filteredVerses.slice(0, 20).map(verse => (
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
                      <p className="text-xs mt-0.5 truncate" style={{ fontFamily: 'serif', color: '#fbbf24', opacity: 0.7 }}>{verse.sanskrit}</p>
                    </div>
                  </button>
                ))}
                {filteredVerses.length === 0 && (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>No matching verses found</p>
                )}
              </div>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}
