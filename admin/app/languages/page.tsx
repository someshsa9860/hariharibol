'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Globe2, Plus, X, Check, AlignRight, Trash2, Edit2 } from 'lucide-react';

interface Language {
  id: string;
  code: string;
  nameNative?: string;
  nativeName?: string;
  nameEnglish?: string;
  englishName?: string;
  isRtl: boolean;
  isActive: boolean;
  fallbackCode?: string | null;
  displayOrder?: number;
}

interface LangForm {
  code: string;
  nativeName: string;
  englishName: string;
  isRtl: boolean;
  isActive: boolean;
  fallbackCode: string;
}

const EMPTY_FORM: LangForm = {
  code: '', nativeName: '', englishName: '', isRtl: false, isActive: true, fallbackCode: 'en',
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className="w-10 h-5 rounded-full relative flex-shrink-0 transition-all duration-200 disabled:opacity-50"
      style={{ background: checked ? '#4ade80' : 'var(--border-2)' }}>
      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
        style={{ left: checked ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

function Skeleton() {
  return <div className="skeleton h-14 rounded-xl" />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
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

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLang, setEditLang] = useState<Language | null>(null);
  const [form, setForm] = useState<LangForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Language | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchLanguages(); }, []);

  const fetchLanguages = async () => {
    setLoading(true);
    try {
      const r = await api.get('/languages');
      setLanguages(Array.isArray(r.data) ? r.data : r.data?.data || []);
    } catch {
      setLanguages([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditLang(null); setError(''); setShowModal(true); };
  const openEdit = (l: Language) => {
    setEditLang(l);
    setForm({
      code: l.code,
      nativeName: l.nameNative ?? l.nativeName ?? '',
      englishName: l.nameEnglish ?? l.englishName ?? '',
      isRtl: l.isRtl,
      isActive: l.isActive,
      fallbackCode: l.fallbackCode ?? 'en',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        code: form.code,
        nameNative: form.nativeName,
        nameEnglish: form.englishName,
        nativeName: form.nativeName,
        englishName: form.englishName,
        isRtl: form.isRtl,
        isActive: form.isActive,
        fallbackCode: form.fallbackCode || 'en',
      };
      if (editLang) {
        await api.patch(`/languages/${editLang.id}`, payload);
      } else {
        await api.post('/languages', payload);
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchLanguages();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save language');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (lang: Language) => {
    setTogglingId(lang.id);
    try {
      await api.patch(`/languages/${lang.id}`, { isActive: !lang.isActive });
      setLanguages(prev => prev.map(l => l.id === lang.id ? { ...l, isActive: !l.isActive } : l));
    } catch { } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.delete(`/languages/${id}`); fetchLanguages(); } catch { }
    finally { setDeletingId(null); setConfirmDelete(null); }
  };

  const getNativeName = (l: Language) => l.nameNative ?? l.nativeName ?? '—';
  const getEnglishName = (l: Language) => l.nameEnglish ?? l.englishName ?? '—';

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <Globe2 size={15} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Languages</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage supported languages and locale settings</p>
            </div>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Plus size={15} /> Add Language
          </button>
        </header>

        <div className="p-8 max-w-5xl mx-auto">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <Globe2 size={14} style={{ color: '#60a5fa' }} />
              <span className="font-bold text-theme text-sm">All Languages</span>
              {!loading && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                  {languages.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
            ) : languages.length === 0 ? (
              <div className="py-16 text-center">
                <Globe2 size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.3 }} />
                <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>No languages configured</p>
                <p className="text-xs" style={{ color: 'var(--muted)', opacity: 0.6 }}>Add your first language to enable translations</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Code</th>
                      <th className="table-header">Native Name</th>
                      <th className="table-header">English Name</th>
                      <th className="table-header">RTL</th>
                      <th className="table-header">Fallback</th>
                      <th className="table-header">Active</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {languages.map((lang, i) => (
                      <tr key={lang.id} className="table-row" style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="table-cell">
                          <code className="font-bold text-sm px-2 py-1 rounded-lg"
                            style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}>
                            {lang.code}
                          </code>
                        </td>
                        <td className="table-cell">
                          <span className="font-semibold text-theme">{getNativeName(lang)}</span>
                        </td>
                        <td className="table-cell">
                          <span style={{ color: 'var(--muted)' }}>{getEnglishName(lang)}</span>
                        </td>
                        <td className="table-cell">
                          {lang.isRtl ? (
                            <span className="badge badge-amber">
                              <AlignRight size={9} className="mr-1" /> RTL
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>LTR</span>
                          )}
                        </td>
                        <td className="table-cell">
                          {lang.fallbackCode ? (
                            <code className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                              {lang.fallbackCode}
                            </code>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--muted)', opacity: 0.5 }}>—</span>
                          )}
                        </td>
                        <td className="table-cell">
                          {togglingId === lang.id ? (
                            <div className="w-4 h-4 rounded-full border-2 border-green-400 border-t-transparent animate-spin" />
                          ) : (
                            <Toggle checked={lang.isActive} onChange={() => handleToggleActive(lang)} />
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEdit(lang)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => setConfirmDelete(lang)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
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
          </div>
        </div>

        {/* Add / Edit Language Modal */}
        {showModal && (
          <Modal title={editLang ? 'Edit Language' : 'Add Language'} onClose={() => setShowModal(false)}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                    Language Code *
                  </label>
                  <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                    type="text" placeholder="hi" maxLength={10} className="input-field" required
                    disabled={!!editLang} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                    Fallback Code
                  </label>
                  <input value={form.fallbackCode} onChange={e => setForm(p => ({ ...p, fallbackCode: e.target.value }))}
                    type="text" placeholder="en" maxLength={10} className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Native Name *
                </label>
                <input value={form.nativeName} onChange={e => setForm(p => ({ ...p, nativeName: e.target.value }))}
                  type="text" placeholder="हिन्दी" className="input-field" required />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  English Name *
                </label>
                <input value={form.englishName} onChange={e => setForm(p => ({ ...p, englishName: e.target.value }))}
                  type="text" placeholder="Hindi" className="input-field" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm(p => ({ ...p, isRtl: !p.isRtl }))}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200"
                  style={{
                    background: form.isRtl ? 'rgba(251,191,36,0.08)' : 'var(--surface)',
                    border: `1px solid ${form.isRtl ? 'rgba(251,191,36,0.25)' : 'var(--border-2)'}`,
                  }}>
                  <Toggle checked={form.isRtl} onChange={v => setForm(p => ({ ...p, isRtl: v }))} />
                  <span className="text-sm font-semibold" style={{ color: form.isRtl ? '#fbbf24' : 'var(--muted)' }}>RTL</span>
                </button>

                <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200"
                  style={{
                    background: form.isActive ? 'rgba(74,222,128,0.08)' : 'var(--surface)',
                    border: `1px solid ${form.isActive ? 'rgba(74,222,128,0.25)' : 'var(--border-2)'}`,
                  }}>
                  <Toggle checked={form.isActive} onChange={v => setForm(p => ({ ...p, isActive: v }))} />
                  <span className="text-sm font-semibold" style={{ color: form.isActive ? '#4ade80' : 'var(--muted)' }}>Active</span>
                </button>
              </div>

              {error && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
                  {submitting
                    ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                    : <Check size={14} />}
                  {submitting ? 'Saving…' : editLang ? 'Save Changes' : 'Add Language'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-5 py-2.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <Modal title="Delete Language" onClose={() => setConfirmDelete(null)}>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <code className="font-bold text-sm px-2 py-1 rounded-lg"
                style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                {confirmDelete.code}
              </code>
              <span className="font-semibold text-theme text-sm">{getNativeName(confirmDelete)}</span>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Deleting this language may break translations that reference it. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete.id)} disabled={deletingId === confirmDelete.id}
                className="btn-danger flex-1 disabled:opacity-50">
                {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete Language'}
              </button>
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}
