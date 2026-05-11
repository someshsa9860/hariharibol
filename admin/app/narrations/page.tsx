'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Plus, Search, Edit2, Trash2, Mic2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Narration {
  id: string;
  saint?: string;
  language?: string;
  sourceText?: string;
  isPublished?: boolean;
  sampraday?: { nameKey: string };
  verse?: { verseNumber: string | number; book?: { title: string } };
}

interface Sampraday { id: string; nameKey: string; }

const LANG_LABELS: Record<string, string> = { en: 'English', hi: 'Hindi', sa: 'Sanskrit', gu: 'Gujarati', mr: 'Marathi' };

export default function NarrationsPage() {
  const [narrations, setNarrations] = useState<Narration[]>([]);
  const [sampradayas, setSampradayas] = useState<Sampraday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSaint, setFilterSaint] = useState('');
  const [filterSampraday, setFilterSampraday] = useState('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<Narration | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const take = 20;

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchNarrations(); }, [skip, search, filterSaint, filterSampraday]);

  const fetchData = async () => {
    try {
      const sr = await api.get('/sampradayas');
      setSampradayas(Array.isArray(sr.data) ? sr.data : sr.data?.data || []);
    } catch { }
  };

  const fetchNarrations = async () => {
    setLoading(true);
    try {
      const r = await api.get('/narrations', {
        params: {
          skip, take,
          search: search || undefined,
          saint: filterSaint || undefined,
          sampradayId: filterSampraday || undefined,
        },
      });
      const d = r.data;
      setNarrations(Array.isArray(d) ? d : d?.data || []);
      setTotal(d?.total ?? (Array.isArray(d) ? d.length : 0));
    } catch { } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.delete(`/narrations/${id}`); fetchNarrations(); } catch { }
    finally { setDeletingId(null); setConfirmDelete(null); }
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
              style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <Mic2 size={15} style={{ color: '#a855f7' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Narrations</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage saint narrations and commentaries</p>
            </div>
          </div>
          <Link href="/narrations/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Plus size={15} /> New Narration
          </Link>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setSkip(0); }}
                placeholder="Search narrations…" className="input-field pl-10" />
            </div>
            <input value={filterSaint} onChange={e => { setFilterSaint(e.target.value); setSkip(0); }}
              placeholder="Filter by saint name…" className="input-field" />
            <select value={filterSampraday} onChange={e => { setFilterSampraday(e.target.value); setSkip(0); }}
              className="select-field">
              <option value="">All Sampradayas</option>
              {sampradayas.map(s => (
                <option key={s.id} value={s.id}>{s.nameKey}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <Mic2 size={14} style={{ color: '#a855f7' }} />
              <span className="font-bold text-theme text-sm">All Narrations</span>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
                  {total}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : narrations.length === 0 ? (
              <div className="py-16 text-center">
                <Mic2 size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.3 }} />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No narrations found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Saint</th>
                      <th className="table-header">Source</th>
                      <th className="table-header">Verse</th>
                      <th className="table-header">Language</th>
                      <th className="table-header">Sampraday</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {narrations.map((n, i) => (
                      <tr key={n.id} className="table-row" style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' }}>
                              {n.saint?.[0]?.toUpperCase() || 'S'}
                            </div>
                            <span className="font-semibold text-theme text-sm">{n.saint || 'Unknown Saint'}</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{n.sourceText || '—'}</span>
                        </td>
                        <td className="table-cell">
                          {n.verse ? (
                            <span className="text-sm" style={{ color: 'var(--text)' }}>
                              {n.verse.book?.title ? `${n.verse.book.title} ` : ''}{n.verse.verseNumber}
                            </span>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td className="table-cell">
                          <span className="badge badge-blue">{LANG_LABELS[n.language || ''] || n.language || '—'}</span>
                        </td>
                        <td className="table-cell">
                          <span className="text-sm" style={{ color: 'var(--muted)' }}>{n.sampraday?.nameKey || '—'}</span>
                        </td>
                        <td className="table-cell">
                          <span className={n.isPublished ? 'badge badge-green' : 'badge badge-amber'}>
                            {n.isPublished ? '● Published' : '○ Draft'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/narrations/${n.id}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                              <Edit2 size={13} />
                            </Link>
                            <button onClick={() => setConfirmDelete(n)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pages > 1 && (
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Page {currentPage} of {pages} · {total} narrations
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSkip(Math.max(0, skip - take))} disabled={skip === 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => setSkip(skip + take)} disabled={skip + take >= total}
                    className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
            <div className="p-6">
              <h3 className="font-bold text-theme mb-2">Delete Narration</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Delete narration by <strong style={{ color: 'var(--text)' }}>{confirmDelete.saint || 'Unknown Saint'}</strong>? This cannot be undone.
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
