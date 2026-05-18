'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  Languages, Search, Check, X, ChevronLeft, ChevronRight,
  Pencil, ExternalLink,
} from 'lucide-react';

interface Translation {
  id: string;
  key: string;
  languageCode: string;
  value: string;
  namespace?: string;
  updatedAt?: string;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', sa: 'Sanskrit', gu: 'Gujarati',
  mr: 'Marathi', te: 'Telugu', ta: 'Tamil', kn: 'Kannada', bn: 'Bengali',
};

function Skeleton() {
  return <div className="skeleton h-12 rounded-xl" />;
}

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const open = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  };

  const save = async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const cancel = () => { setEditing(false); setDraft(value); };

  if (editing) {
    return (
      <div className="flex items-start gap-2 min-w-0">
        <textarea
          ref={ref}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
            if (e.key === 'Escape') cancel();
          }}
          rows={2}
          className="input-field text-xs py-1.5 px-2.5 flex-1 min-w-0 resize-none"
        />
        <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
          <button onClick={save} disabled={saving}
            className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-50"
            style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
            {saving
              ? <div className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
              : <Check size={11} />}
          </button>
          <button onClick={cancel}
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
            <X size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={open}
      className="group flex items-start gap-2 w-full text-left min-w-0 rounded-lg px-2 py-1 -ml-2 transition-all duration-150"
      style={{ background: 'transparent' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <span className="text-sm flex-1 min-w-0 leading-relaxed" style={{ color: 'var(--text)' }}>
        {value || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}
      </span>
      <Pencil size={11} className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--muted)' }} />
    </button>
  );
}

export default function TranslationsPage() {
  const router = useRouter();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLang, setFilterLang] = useState('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const take = 50;

  useEffect(() => { fetchTranslations(); }, [skip, search, filterLang]);

  const fetchTranslations = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { skip, take };
      if (search) params.search = search;
      if (filterLang) params.languageCode = filterLang;
      const r = await api.get('/translations', { params });
      const d = r.data;
      setTranslations(Array.isArray(d) ? d : d?.data || []);
      setTotal(d?.total ?? (Array.isArray(d) ? d.length : 0));
    } catch { } finally { setLoading(false); }
  };

  const handleSave = async (id: string, value: string) => {
    await api.patch(`/translations/${id}`, { value });
    setTranslations(prev =>
      prev.map(t => t.id === id ? { ...t, value, updatedAt: new Date().toISOString() } : t)
    );
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const pages = Math.ceil(total / take);
  const currentPage = Math.floor(skip / take) + 1;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <Languages size={15} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Translations</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Inline editing — click any value to edit</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/translations/workspace')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
            <ExternalLink size={14} /> Open Workspace
          </button>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-6">

          {/* Search + filter */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--muted)' }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setSkip(0); }}
                placeholder="Search by key or value…"
                className="input-field pl-10"
              />
            </div>
            <div className="relative">
              <Languages size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--muted)' }} />
              <select value={filterLang}
                onChange={e => { setFilterLang(e.target.value); setSkip(0); }}
                className="select-field pl-8">
                <option value="">All Languages</option>
                {Object.entries(LANG_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>{name} ({code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <div className="px-6 py-4 flex items-center gap-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <Languages size={15} style={{ color: '#60a5fa' }} />
              <span className="font-bold text-theme text-sm">Translations</span>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                  {total}
                </span>
              )}
              <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
                Click any value cell to edit inline
              </span>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} />)}
              </div>
            ) : translations.length === 0 ? (
              <div className="py-16 text-center">
                <Languages size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.3 }} />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No translations found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header w-28">Language</th>
                      <th className="table-header">Key</th>
                      <th className="table-header">Value</th>
                      <th className="table-header w-32">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {translations.map((t, i) => (
                      <tr key={t.id} className="table-row" style={{ animationDelay: `${i * 20}ms` }}>
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <code className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                              {t.languageCode}
                            </code>
                            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                              {LANG_NAMES[t.languageCode] ?? t.languageCode}
                            </span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <div>
                            <code className="text-xs px-2 py-0.5 rounded break-all"
                              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                              {t.key}
                            </code>
                            {t.namespace && (
                              <span className="ml-2 badge badge-blue" style={{ fontSize: '9px' }}>
                                {t.namespace}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell max-w-xs">
                          <InlineEdit
                            value={t.value}
                            onSave={v => handleSave(t.id, v)}
                          />
                        </td>
                        <td className="table-cell">
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {formatDate(t.updatedAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pages > 1 && (
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Page {currentPage} of {pages} · {total} entries
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSkip(Math.max(0, skip - take))} disabled={skip === 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => setSkip(skip + take)} disabled={skip + take >= total}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
