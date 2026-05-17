'use client';

import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Plus, Search, Trash2, Edit2, Music, X, Check, Upload, ChevronLeft, ChevronRight } from 'lucide-react';

interface Mantra {
  id: string;
  nameKey: string;
  name?: string;
  nameHi?: string;
  category?: string;
  isPublic: boolean;
  isPublished?: boolean;
  sampradayId?: string;
  sampraday?: { id: string; nameKey: string };
  relatedDeityKey?: string;
  audioUrl?: string;
  sanskrit?: string;
  transliteration?: string;
  meaningKey?: string;
  significanceKey?: string;
  recommendationCount?: number;
  recommendedCount?: number;
}

interface Sampraday { id: string; nameKey: string; }

interface MantraForm {
  sampradayId: string;
  nameKey: string;
  sanskrit: string;
  transliteration: string;
  meaningKey: string;
  significanceKey: string;
  relatedDeityKey: string;
  category: string;
  isPublic: boolean;
  audioFile?: File;
  audioUrl?: string;
}

const EMPTY_FORM: MantraForm = {
  sampradayId: '', nameKey: '', sanskrit: '', transliteration: '',
  meaningKey: '', significanceKey: '', relatedDeityKey: '', category: 'mahamantra', isPublic: true,
};

const CATEGORIES = ['mahamantra', 'beej', 'stotra', 'name', 'other'];

const DEITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  krishna:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)' },
  vishnu:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' },
  rama:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.25)' },
  shiva:    { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  devi:     { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.25)' },
  durga:    { color: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.25)' },
  ganesh:   { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.25)' },
  hanuman:  { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.25)' },
  saraswati:{ color: '#f0abfc', bg: 'rgba(240,171,252,0.12)', border: 'rgba(240,171,252,0.25)' },
  lakshmi:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)' },
};

function deityStyle(key?: string) {
  if (!key) return { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' };
  const lk = key.toLowerCase();
  for (const [deity, style] of Object.entries(DEITY_COLORS)) {
    if (lk.includes(deity)) return style;
  }
  return { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.25)' };
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

export default function MantrasPage() {
  const [mantras, setMantras] = useState<Mantra[]>([]);
  const [sampradayas, setSampradayas] = useState<Sampraday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSampraday, setFilterSampraday] = useState('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<Mantra | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editMantra, setEditMantra] = useState<Mantra | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<MantraForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const audioRef = useRef<HTMLInputElement>(null);
  const take = 20;

  useEffect(() => { fetchSampradayas(); }, []);
  useEffect(() => { fetchMantras(); }, [skip, search, filterSampraday]);

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
        params: { skip, take, search: search || undefined, sampradayId: filterSampraday || undefined },
      });
      const d = r.data;
      setMantras(Array.isArray(d) ? d : d?.data || []);
      setTotal(d?.total ?? (Array.isArray(d) ? d.length : 0));
    } catch { } finally { setLoading(false); }
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sampradayId: sampradayas[0]?.id ?? '' });
    setEditMantra(null);
    setShowModal(true);
  };

  const openEdit = (m: Mantra) => {
    setEditMantra(m);
    setForm({
      sampradayId: m.sampradayId ?? m.sampraday?.id ?? '',
      nameKey: m.nameKey ?? m.name ?? '',
      sanskrit: m.sanskrit ?? '',
      transliteration: m.transliteration ?? '',
      meaningKey: m.meaningKey ?? '',
      significanceKey: m.significanceKey ?? '',
      relatedDeityKey: m.relatedDeityKey ?? '',
      category: m.category ?? 'mahamantra',
      isPublic: m.isPublic,
      audioUrl: m.audioUrl,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        sampradayId: form.sampradayId,
        nameKey: form.nameKey,
        sanskrit: form.sanskrit || undefined,
        transliteration: form.transliteration || undefined,
        meaningKey: form.meaningKey || undefined,
        significanceKey: form.significanceKey || undefined,
        relatedDeityKey: form.relatedDeityKey || undefined,
        category: form.category,
        isPublic: form.isPublic,
      };
      if (form.audioFile) {
        const fd = new FormData();
        fd.append('file', form.audioFile);
        const up = await api.post('/mantras/upload-audio', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.audioUrl = up.data?.url;
      }
      if (editMantra) {
        await api.patch(`/mantras/${editMantra.id}`, payload);
      } else {
        await api.post('/mantras', payload);
      }
      setShowModal(false);
      fetchMantras();
    } catch { } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.delete(`/mantras/${id}`); fetchMantras(); } catch { }
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
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Music size={15} style={{ color: '#fbbf24' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Mantras</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage sacred chants and mantras</p>
            </div>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Plus size={15} /> Add Mantra
          </button>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setSkip(0); }}
                placeholder="Search mantras…" className="input-field pl-10" />
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
              <Music size={15} style={{ color: '#fbbf24' }} />
              <span className="font-bold text-theme text-sm">All Mantras</span>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  {total}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
            ) : mantras.length === 0 ? (
              <div className="py-16 text-center">
                <Music size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.3 }} />
                <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>No mantras found</p>
                <p className="text-xs" style={{ color: 'var(--muted)', opacity: 0.6 }}>Add your first sacred mantra to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Name</th>
                      <th className="table-header">Deity</th>
                      <th className="table-header">Category</th>
                      <th className="table-header">Audio</th>
                      <th className="table-header">Visibility</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mantras.map((m, i) => {
                      const ds = deityStyle(m.relatedDeityKey);
                      const deityLabel = m.relatedDeityKey
                        ? m.relatedDeityKey.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        : null;
                      return (
                        <tr key={m.id} className="table-row" style={{ animationDelay: `${i * 30}ms` }}>
                          <td className="table-cell">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                <Music size={14} style={{ color: '#fbbf24' }} />
                              </div>
                              <div>
                                <span className="font-semibold text-theme text-sm block">{m.name ?? m.nameKey}</span>
                                {m.nameHi && (
                                  <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'serif' }}>{m.nameHi}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="table-cell">
                            {deityLabel ? (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                                style={{ background: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}>
                                {deityLabel}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                            )}
                          </td>
                          <td className="table-cell">
                            {m.category ? (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize"
                                style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                                {m.category}
                              </span>
                            ) : <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>}
                          </td>
                          <td className="table-cell">
                            {m.audioUrl ? (
                              <span className="badge badge-green">● Has Audio</span>
                            ) : (
                              <span className="badge badge-amber">○ No Audio</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <span className={m.isPublic ? 'badge badge-green' : 'badge badge-amber'}>
                              {m.isPublic ? 'Public' : 'Private'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openEdit(m)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                                style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => setConfirmDelete(m)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171' }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pages > 1 && (
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Page {currentPage} of {pages} · {total} mantras
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
        <Modal title={editMantra ? 'Edit Mantra' : 'Add Mantra'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sampraday */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Sampraday *
              </label>
              <select value={form.sampradayId}
                onChange={e => setForm(p => ({ ...p, sampradayId: e.target.value }))}
                className="select-field" required>
                <option value="">Select sampraday…</option>
                {sampradayas.map(s => <option key={s.id} value={s.id}>{s.nameKey}</option>)}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Name Key *
              </label>
              <input value={form.nameKey} onChange={e => setForm(p => ({ ...p, nameKey: e.target.value }))}
                placeholder="e.g. hare-krishna-mahamantra" className="input-field" required />
            </div>

            {/* Sanskrit text */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Sanskrit Text
              </label>
              <textarea value={form.sanskrit} onChange={e => setForm(p => ({ ...p, sanskrit: e.target.value }))}
                rows={3} placeholder="Sanskrit verse or mantra text…" className="input-field resize-none" />
            </div>

            {/* Transliteration */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Transliteration
              </label>
              <textarea value={form.transliteration} onChange={e => setForm(p => ({ ...p, transliteration: e.target.value }))}
                rows={2} placeholder="Latin script transliteration…" className="input-field resize-none" />
            </div>

            {/* Meaning + Significance in a 2-col grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Meaning Key
                </label>
                <input value={form.meaningKey} onChange={e => setForm(p => ({ ...p, meaningKey: e.target.value }))}
                  placeholder="i18n key for meaning" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Benefits Key
                </label>
                <input value={form.significanceKey} onChange={e => setForm(p => ({ ...p, significanceKey: e.target.value }))}
                  placeholder="i18n key for benefits" className="input-field" />
              </div>
            </div>

            {/* Deity + Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Deity
                </label>
                <input value={form.relatedDeityKey} onChange={e => setForm(p => ({ ...p, relatedDeityKey: e.target.value }))}
                  placeholder="e.g. krishna, shiva, devi" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Category
                </label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="select-field">
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
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
                  style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <Upload size={15} style={{ color: '#fbbf24' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-theme">
                    {form.audioFile ? form.audioFile.name : form.audioUrl ? 'Audio uploaded' : 'Upload audio file'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>MP3, WAV, OGG up to 50 MB</p>
                </div>
                <input ref={audioRef} type="file" accept="audio/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setForm(p => ({ ...p, audioFile: f })); }} />
              </div>
            </div>

            {/* Public toggle */}
            <div className="flex items-center gap-3 py-1">
              <button type="button"
                onClick={() => setForm(p => ({ ...p, isPublic: !p.isPublic }))}
                className="w-10 h-5 rounded-full relative flex-shrink-0 transition-all duration-200"
                style={{ background: form.isPublic ? '#4ade80' : 'var(--border-2)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
                  style={{ left: form.isPublic ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
              <span className="text-sm font-semibold" style={{ color: form.isPublic ? '#4ade80' : 'var(--muted)' }}>
                {form.isPublic ? 'Public' : 'Private'}
              </span>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting || !form.sampradayId || !form.nameKey}
                className="flex items-center gap-2 flex-1 justify-center px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
                {submitting
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <Check size={14} />}
                {submitting ? 'Saving…' : editMantra ? 'Save Changes' : 'Add Mantra'}
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
              <h3 className="font-bold text-theme mb-2">Delete Mantra</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Delete <strong style={{ color: 'var(--text)' }}>{confirmDelete.name ?? confirmDelete.nameKey}</strong>? This cannot be undone.
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
