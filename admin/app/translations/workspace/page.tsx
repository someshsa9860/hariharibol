'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { PenSquare, Check, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'mr', name: 'Marathi' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' },
];
const NAMESPACES = ['All', 'UI', 'Sampradayas', 'Books', 'Verses', 'Narrations', 'Mantras'];
const STATUSES = ['all', 'missing', 'draft', 'approved'];

interface TranslationPair {
  key: string;
  namespace: string;
  source: string;
  target: string;
  status: 'missing' | 'draft' | 'approved';
}

function Skeleton() {
  return <div className="skeleton rounded-xl" style={{ height: 56 }} />;
}

function WorkspaceInner() {
  const params = useSearchParams();
  const [lang, setLang] = useState(params.get('lang') || 'hi');
  const [namespace, setNamespace] = useState(params.get('namespace') || 'All');
  const [status, setStatus] = useState<string>('all');
  const [pairs, setPairs] = useState<TranslationPair[]>([]);
  const [selected, setSelected] = useState<TranslationPair | null>(null);
  const [targetText, setTargetText] = useState('');
  const [pairStatus, setPairStatus] = useState<'missing' | 'draft' | 'approved'>('draft');
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchPairs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/translations', {
        params: { lang, namespace: namespace === 'All' ? undefined : namespace, status: status === 'all' ? undefined : status },
      });
      const data: TranslationPair[] = r.data?.items || r.data || generateMockPairs(lang, namespace);
      setPairs(data);
      if (data.length > 0 && !selected) selectPair(data[0]);
    } catch {
      const mock = generateMockPairs(lang, namespace);
      setPairs(mock);
      if (mock.length > 0 && !selected) selectPair(mock[0]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, namespace, status]);

  useEffect(() => { fetchPairs(); }, [fetchPairs]);

  const selectPair = (pair: TranslationPair) => {
    setSelected(pair);
    setTargetText(pair.target || '');
    setPairStatus(pair.status === 'missing' ? 'draft' : pair.status);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSave = async (andNext = false) => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/admin/translations/${encodeURIComponent(selected.key)}`, {
        lang,
        value: targetText,
        status: pairStatus,
      });
      setSavedKey(selected.key);
      setTimeout(() => setSavedKey(null), 2000);
      setPairs(prev => prev.map(p =>
        p.key === selected.key ? { ...p, target: targetText, status: pairStatus } : p
      ));
      setSelected(prev => prev ? { ...prev, target: targetText, status: pairStatus } : prev);
      if (andNext) {
        const idx = pairs.findIndex(p => p.key === selected.key);
        if (idx < pairs.length - 1) selectPair(pairs[idx + 1]);
      }
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave(true);
    }
  };

  const selectedIdx = selected ? pairs.findIndex(p => p.key === selected.key) : -1;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto flex flex-col">

        {/* Header */}
        <header className="px-8 py-4 flex items-center gap-4 sticky top-0 z-10 flex-wrap"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3 mr-auto">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <PenSquare size={15} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Translation Workspace</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Edit and approve translations</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select value={lang} onChange={e => setLang(e.target.value)}
                className="select-field pr-8 pl-3 py-2 text-sm" style={{ width: 130 }}>
                {LANGUAGES.filter(l => l.code !== 'en').map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <select value={namespace} onChange={e => setNamespace(e.target.value)}
                className="select-field pr-8 pl-3 py-2 text-sm" style={{ width: 140 }}>
                {NAMESPACES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="relative">
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="select-field pr-8 pl-3 py-2 text-sm" style={{ width: 130 }}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <button onClick={fetchPairs} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
              <RotateCcw size={14} />
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">

          {/* Pairs list */}
          <div className="w-80 flex-shrink-0 overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center gap-2 sticky top-0"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Strings
              </span>
              {!loading && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                  {pairs.length}
                </span>
              )}
            </div>

            <div className="p-2 space-y-1">
              {loading ? (
                [1,2,3,4,5,6].map(i => <Skeleton key={i} />)
              ) : pairs.map((pair) => {
                const isActive = selected?.key === pair.key;
                const statusColors: Record<string, string> = { missing: '#f87171', draft: '#fbbf24', approved: '#4ade80' };
                return (
                  <button key={pair.key} onClick={() => selectPair(pair)}
                    className="w-full text-left rounded-xl px-3 py-2.5 transition-all duration-150"
                    style={{
                      background: isActive ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                      border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'transparent'}`,
                    }}>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColors[pair.status] }} />
                      <span className="text-xs font-medium truncate" style={{ color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                        {pair.key}
                      </span>
                    </div>
                    <div className="text-[10px] mt-1 truncate pl-3.5" style={{ color: 'var(--muted)' }}>
                      {pair.source}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Select a string from the list</p>
              </div>
            ) : (
              <>
                {/* Key info bar */}
                <div className="px-6 py-3 flex items-center gap-3 flex-wrap"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <code className="text-xs px-2 py-1 rounded-lg font-bold"
                    style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
                    {selected.key}
                  </code>
                  <span className="badge badge-blue text-[10px]">{selected.namespace}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => { if (selectedIdx > 0) selectPair(pairs[selectedIdx - 1]); }}
                      disabled={selectedIdx <= 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all duration-200"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                      <ChevronLeft size={13} />
                    </button>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{selectedIdx + 1}/{pairs.length}</span>
                    <button onClick={() => { if (selectedIdx < pairs.length - 1) selectPair(pairs[selectedIdx + 1]); }}
                      disabled={selectedIdx >= pairs.length - 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all duration-200"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Side-by-side editor */}
                <div className="flex-1 grid grid-cols-2 overflow-hidden" style={{ gap: 0 }}>
                  {/* Left: English source */}
                  <div className="p-6 overflow-y-auto flex flex-col gap-3" style={{ borderRight: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>English Source</span>
                      <span className="ml-auto badge badge-green text-[9px]">Read-only</span>
                    </div>
                    <div className="rounded-xl p-4 flex-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{selected.source}</p>
                    </div>
                  </div>

                  {/* Right: Target translation */}
                  <div className="p-6 overflow-y-auto flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                        {LANGUAGES.find(l => l.code === lang)?.name ?? lang} Translation
                      </span>
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={targetText}
                      onChange={e => setTargetText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={6}
                      placeholder={`Enter ${LANGUAGES.find(l => l.code === lang)?.name ?? lang} translation…`}
                      className="input-field resize-none leading-relaxed"
                    />

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>Status</label>
                        <select value={pairStatus} onChange={e => setPairStatus(e.target.value as 'draft' | 'approved')}
                          className="select-field py-2 text-sm">
                          <option value="draft">Draft</option>
                          <option value="approved">Approved</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button onClick={() => handleSave(false)} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
                        {saving ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" /> : <Check size={14} />}
                        Save
                      </button>
                      <button onClick={() => handleSave(true)} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
                        style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
                        Save & Next
                        <kbd className="ml-1 text-[9px] px-1 py-0.5 rounded opacity-60"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
                          ⌃↵
                        </kbd>
                      </button>

                      {savedKey === selected.key && (
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#4ade80' }}>
                          <Check size={12} /> Saved
                        </span>
                      )}
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Tip: Press Ctrl+Enter to save and move to the next string</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        </main>
      </div>
    }>
      <WorkspaceInner />
    </Suspense>
  );
}

function generateMockPairs(lang: string, ns: string): TranslationPair[] {
  const namespaceStr = ns === 'All' ? 'UI' : ns;
  return [
    { key: `${namespaceStr.toLowerCase()}.home.title`, namespace: namespaceStr, source: 'Welcome to HariHariBol', target: lang === 'hi' ? 'हरिहरीबोल में आपका स्वागत है' : '', status: lang === 'hi' ? 'approved' : 'missing' },
    { key: `${namespaceStr.toLowerCase()}.home.subtitle`, namespace: namespaceStr, source: 'Your daily spiritual companion', target: '', status: 'missing' },
    { key: `${namespaceStr.toLowerCase()}.verse.of.day`, namespace: namespaceStr, source: 'Verse of the Day', target: lang === 'hi' ? 'दिन का श्लोक' : '', status: lang === 'hi' ? 'draft' : 'missing' },
    { key: `${namespaceStr.toLowerCase()}.auth.login`, namespace: namespaceStr, source: 'Sign In', target: '', status: 'missing' },
    { key: `${namespaceStr.toLowerCase()}.auth.logout`, namespace: namespaceStr, source: 'Sign Out', target: '', status: 'missing' },
    { key: `${namespaceStr.toLowerCase()}.nav.home`, namespace: namespaceStr, source: 'Home', target: '', status: 'missing' },
    { key: `${namespaceStr.toLowerCase()}.nav.explore`, namespace: namespaceStr, source: 'Explore', target: '', status: 'missing' },
  ];
}
