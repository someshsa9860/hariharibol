'use client';

import { useEffect, useState } from 'react';
import { Music2, Search, Play, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';

function MantraItem({ m }: { m: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card-hover p-4 mb-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold text-sm mb-1" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>{m.name}</h3>
          {m.category && <span className="badge text-xs">{m.category}</span>}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="btn-ghost p-1.5">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {m.text && <p className="verse-sanskrit text-sm mt-2 whitespace-pre-line">{m.text}</p>}
      {expanded && (
        <div className="mt-2 animate-fade-in space-y-2">
          {m.transliteration && <p className="verse-iast text-xs">{m.transliteration}</p>}
          {m.meaning && <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{m.meaning}</p>}
          {m.audioUrl && (
            <button className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              <Play size={12} fill="currentColor" /> Play
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppMantrasPage() {
  const [mantras, setMantras] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/mantras?take=100')
      .then(r => { const d = r.data?.data || r.data || []; setMantras(d); setFiltered(d); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(mantras); return; }
    const q = search.toLowerCase();
    setFiltered(mantras.filter((m) => m.name?.toLowerCase().includes(q) || m.text?.toLowerCase().includes(q)));
  }, [search, mantras]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Mantras" />
      <div className="p-4 max-w-xl mx-auto">
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input className="input-field pl-9 text-sm" placeholder="Search mantras…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card p-4"><div className="skeleton h-4 w-1/2 mb-2" /><div className="skeleton h-6 w-full" /></div>)}</div>
        ) : filtered.length > 0 ? (
          filtered.map((m) => <MantraItem key={m.id} m={m} />)
        ) : (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <Music2 size={36} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm">No mantras available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
