'use client';

import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Plus, Search, Edit2, Trash2, Mic2, ChevronLeft, ChevronRight, X, Check, Upload } from 'lucide-react';

interface Narration {
  id: string;
  saintNameKey?: string;
  saint?: string;
  narrationKey?: string;
  sourceKey?: string;
  sourceYear?: number;
  audioUrl?: string;
  audioDuration?: number;
  language?: string;
  isPublished?: boolean;
  sampradayId?: string;
  sampraday?: { id: string; nameKey: string };
  verseId?: string;
  verse?: { verseNumber: string | number; book?: { title: string } };
}

interface Sampraday { id: string; nameKey: string; }

interface NarrationForm {
  saintNameKey: string;
  narrationKey: string;
  sourceKey: string;
  sourceYear: string;
  sampradayId: string;
  isPublished: boolean;
  audioFile?: File;
  audioUrl?: string;
}

const EMPTY_FORM: NarrationForm = {
  saintNameKey: '', narrationKey: '', sourceKey: '', sourceYear: '',
  sampradayId: '', isPublished: false,
};

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Skeleton() {
  return <div className="skeleton h-14 rounded-xl" />;
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
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function NarrationsPage() {
  const [narrations, setNarrations] = useState<Narration[]>([]);
  const [sampradayas, setSampradayas] = useState<Sampraday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSampraday, setFilterSampraday] = useState('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<Narration | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editNarration, setEditNarration] = useState<Narration | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NarrationForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const audioRef = useRef<HTMLInputElement>(null);
  const take = 20;

  useEffect(() => { fetchSampradayas(); }, []);
  useEffect(() => { fetchNarrations(); }, [skip, search, filterSampraday]);

  const fetchSampradayas = async () => {
    try {
      const r = await api.get('/sampradayas');
      setSampradayas(Array.isArray(r.data) ? r.data : r.data?.data || []);
    } catch { }
  };

  const fetchNarrations = async () => {
    setLoading(true);
    try {
      const r = await api.get('/narrations', {
        params: { skip, take, search: search || undefined, sampradayId: filterSampraday || undefined },
      });
      const d = r.data;
      setNarrations(Array.isArray(d) ? d : d?.data || []);
      setTotal(d?.total ?? (Array.isArray(d) ? d.length : 0));
    } catch { } finally { setLoading(false); }
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditNarration(null); setShowModal(true); };
  const openEdit = (n: Narration) => {
    setEditNarration(n);
    setForm({
      saintNameKey: n.saintNameKey ?? n.saint ?? '',
      narrationKey: n.narrationKey ?? '',
      sourceKey: n.sourceKey ?? '',
      sourceYear: n.sourceYear ? String(n.sourceYear) : '',
      sampradayId: n.sampradayId ?? n.sampraday?.id ?? '',
      isPublished: n.isPublished ?? false,
      audioUrl: n.audioUrl,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        saintNameKey: form.saintNameKey,
        narrationKey: form.narrationKey,
        sourceKey: form.sourceKey || undefined,
        sourceYear: form.sourceYear ? Number(form.sourceYear) : undefined,
        sampradayId: form.sampradayId || undefined,
        isPublished: form.isPublished,
      };
      if (form.audioFile) {
        const fd = new FormData();
        fd.append('file', form.audioFile);
        const up = await api.post('/narrations/upload-audio', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.audioUrl = up.data?.url;
      }
      if (editNarration) {
        await api.patch(`/narrations/${editNarration.id}`, payload);
      } else {
        await api.post('/narrations', payload);
      }
      setShowModal(false);
      fetchNarrations();
    } catch { } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.delete(`/narrations/${id}`); fetchNarrations(); } catch { }
    finally { setDeletingId(null); setConfirmDelete(null); }
  };

  const pages = Math.ceil(total / take);
  const currentPage = Math.floor(skip / take) + 1;

  const displayTitle = (n: Narration) => {
    if (n.sourceKey) return n.sourceKey.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (n.narrationKey) {
      const excerpt = n.narrationKey.slice(0, 50);
      return excerpt.length < n.narrationKey.length ? `${excerpt}…` : excerpt;
    }
    return 'Untitled Narration';
  };

  const displaySaint = (n: Narration) => n.saint ?? n.saintNameKey ?? 'Unknown Saint';

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
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Plus size={15} /> Add Narration
          </button>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setSkip(0); }}
                placeholder="Search narrations…" className="input-field pl-10" />
            </div>
            <select value={filterSampraday} onChange={e => { setFilterSampraday(e.target.value); setSkip(0); }} className="select-field">
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
                <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>No narrations found</p>
                <p className="text-xs" style={{ color: 'var(--muted)', opacity: 0.6 }}>Add the first saint narration or commentary</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Title</th>
                      <th className="table-header">Saint</th>
                      <th className="table-header">Duration</th>
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
                              <Mic2 size={14} />
                            </div>
                            <span className="font-semibold text-theme text-sm">{displayTitle(n)}</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="text-sm" style={{ color: 'var(--text)' }}>{displaySaint(n)}</span>
                        </td>
                        <td className="table-cell">
                          {n.audioUrl ? (
                            <span className="text-sm font-mono" style={{ color: 'var(--muted)' }}>
                              {formatDuration(n.audioDuration)}
                            </span>
                          ) : (
                            <span className="badge badge-amber">○ No Audio</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className="text-sm" style={{ color: 'var(--muted)' }}>
                            {n.sampraday?.nameKey ?? '—'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={n.isPublished ? 'badge badge-green' : 'badge badge-amber'}>
                            {n.isPublished ? '● Published' : '○ Draft'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEdit(n)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                              <Edit2 size={13} />
                            </button>
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

      {/* Create / Edit modal */}
      {showModal && (
        <Modal title={editNarration ? 'Edit Narration' : 'Add Narration'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Saint name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Saint Name Key *
              </label>
              <input value={form.saintNameKey} onChange={e => setForm(p => ({ ...p, saintNameKey: e.target.value }))}
                placeholder="e.g. srila-prabhupada" className="input-field" required />
            </div>

            {/* Source */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Source Key
                </label>
                <input value={form.sourceKey} onChange={e => setForm(p => ({ ...p, sourceKey: e.target.value }))}
                  placeholder="e.g. purport.bg.1.1" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Source Year
                </label>
                <input value={form.sourceYear} onChange={e => setForm(p => ({ ...p, sourceYear: e.target.value }))}
                  type="number" placeholder="e.g. 1972" min="1000" max="2100" className="input-field" />
              </div>
            </div>

            {/* Narration text / key */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Narration Key *
              </label>
              <textarea value={form.narrationKey} onChange={e => setForm(p => ({ ...p, narrationKey: e.target.value }))}
                rows={4} placeholder="Narration i18n key or text excerpt…" className="input-field resize-none" required />
            </div>

            {/* Sampraday */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Sampraday
              </label>
              <select value={form.sampradayId} onChange={e => setForm(p => ({ ...p, sampradayId: e.target.value }))} className="select-field">
                <option value="">None</option>
                {sampradayas.map(s => <option key={s.id} value={s.id}>{s.nameKey}</option>)}
              </select>
            </div>

            {/* Audio upload */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Audio File
              </label>
              <div
                onClick={() => audioRef.current?.click()}
                className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200"
                style={{ border: '1.5px dashed var(--border-2)', background: 'var(--surface)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  <Upload size={15} style={{ color: '#a855f7' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-theme">
                    {form.audioFile ? form.audioFile.name : form.audioUrl ? 'Audio uploaded' : 'Upload narration audio'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>MP3, WAV, OGG up to 100 MB</p>
                </div>
                <input ref={audioRef} type="file" accept="audio/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setForm(p => ({ ...p, audioFile: f })); }} />
              </div>
            </div>

            {/* Published toggle */}
            <div className="flex items-center gap-3 py-1">
              <button type="button"
                onClick={() => setForm(p => ({ ...p, isPublished: !p.isPublished }))}
                className="w-10 h-5 rounded-full relative flex-shrink-0 transition-all duration-200"
                style={{ background: form.isPublished ? '#4ade80' : 'var(--border-2)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
                  style={{ left: form.isPublished ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
              <span className="text-sm font-semibold" style={{ color: form.isPublished ? '#4ade80' : 'var(--muted)' }}>
                {form.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting || !form.saintNameKey || !form.narrationKey}
                className="flex items-center gap-2 flex-1 justify-center px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
                {submitting
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <Check size={14} />}
                {submitting ? 'Saving…' : editNarration ? 'Save Changes' : 'Add Narration'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
            <div className="p-6">
              <h3 className="font-bold text-theme mb-2">Delete Narration</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Delete narration by <strong style={{ color: 'var(--text)' }}>{displaySaint(confirmDelete)}</strong>? This cannot be undone.
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
