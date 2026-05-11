'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Plus, Search, Trash2, Edit2, Music } from 'lucide-react';

interface Mantra {
  id: string;
  name: string;
  nameHi?: string;
  category?: string;
  isPublic: boolean;
  isPublished?: boolean;
  sampraday?: { id: string; nameKey: string };
  recommendationCount?: number;
}

interface Sampraday { id: string; nameKey: string; }

export default function MantrasPage() {
  const [mantras, setMantras] = useState<Mantra[]>([]);
  const [sampradayas, setSampradayas] = useState<Sampraday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSampraday, setFilterSampraday] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Mantra | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchSampradayas(); }, []);
  useEffect(() => { fetchMantras(); }, [search, filterSampraday]);

  const fetchSampradayas = async () => {
    try {
      const r = await api.get('/sampradayas');
      setSampradayas(Array.isArray(r.data) ? r.data : r.data?.data || []);
    } catch { }
  };

  const fetchMantras = async () => {
    setLoading(true);
    try {
      const r = await api.get('/mantras', {
        params: { search: search || undefined, sampradayId: filterSampraday || undefined },
      });
      const d = r.data;
      setMantras(Array.isArray(d) ? d : d?.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.delete(`/mantras/${id}`); fetchMantras(); } catch { }
    finally { setDeletingId(null); setConfirmDelete(null); }
  };

  const filtered = mantras.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Music size={15} style={{ color: '#fbbf24' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Mantras</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage sacred chants and mantras</p>
            </div>
          </div>
          <Link href="/mantras/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Plus size={15} /> New Mantra
          </Link>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search mantras…" className="input-field pl-10" />
            </div>
            <select value={filterSampraday} onChange={e => setFilterSampraday(e.target.value)} className="select-field">
              <option value="">All Sampradayas</option>
              {sampradayas.map(s => (
                <option key={s.id} value={s.id}>{s.nameKey}</option>
              ))}
            </select>
          </div>

          {/* Card grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Music size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.3 }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No mantras found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((m, i) => (
                <div key={m.id} className="card-hover group relative" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="p-5">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-3">
                      {m.sampraday && (
                        <span className="badge badge-orange text-[10px]">{m.sampraday.nameKey}</span>
                      )}
                      <span className={m.isPublic ? 'badge badge-green text-[10px]' : 'badge badge-amber text-[10px]'}>
                        {m.isPublic ? 'Public' : 'Private'}
                      </span>
                      {m.category && (
                        <span className="badge badge-blue text-[10px]">{m.category}</span>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}>
                        <Music size={16} style={{ color: '#fbbf24' }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-theme text-sm leading-tight truncate">{m.name}</h3>
                        {m.nameHi && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)', fontFamily: 'serif' }}>{m.nameHi}</p>
                        )}
                      </div>
                    </div>

                    {/* Recommendation count */}
                    {m.recommendationCount !== undefined && (
                      <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                        {m.recommendationCount.toLocaleString()} recommendations
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Link href={`/mantras/${m.id}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                      <Edit2 size={12} />
                    </Link>
                    <button onClick={() => setConfirmDelete(m)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
            <div className="p-6">
              <h3 className="font-bold text-theme mb-2">Delete Mantra</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Delete <strong style={{ color: 'var(--text)' }}>{confirmDelete.name}</strong>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(confirmDelete.id)} disabled={deletingId === confirmDelete.id}
                  className="btn-danger flex-1 disabled:opacity-50">
                  {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
                </button>
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
