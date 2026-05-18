'use client';

import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  Plus, Trash2, Pencil, Upload, BookOpen, X, Check,
  Globe2, Users, LayoutGrid,
} from 'lucide-react';

interface Sampraday {
  id: string;
  slug: string;
  nameKey: string;
  isPublished: boolean;
  followerCount: number;
  displayOrder: number;
  heroImageUrl?: string;
  thumbnailUrl?: string;
  _count?: { groups?: number; followers?: number };
}

interface SampradayForm {
  slug: string;
  nameKey: string;
  descriptionKey: string;
  founderKey: string;
  primaryDeityKey: string;
  philosophyKey: string;
  foundingYear: number;
  regionKey: string;
  isPublished: boolean;
  displayOrder: number;
  heroImageFile?: File;
  thumbnailImageFile?: File;
}

const EMPTY_FORM: SampradayForm = {
  slug: '', nameKey: '', descriptionKey: '', founderKey: '',
  primaryDeityKey: '', philosophyKey: '',
  foundingYear: new Date().getFullYear(),
  regionKey: '', isPublished: false, displayOrder: 0,
};

function Skeleton() {
  return <div className="skeleton h-14 rounded-xl" />;
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--surface-2)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full"
              style={{ background: 'linear-gradient(var(--accent), var(--accent-2))' }} />
            <h2 className="font-bold text-theme text-sm">{title}</h2>
          </div>
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

function UploadZone({ label, preview, onClick, inputRef, onChange }: {
  label: string; preview?: string;
  onClick: () => void; inputRef: React.RefObject<HTMLInputElement>;
  onChange: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--muted)' }}>{label}</label>
      <div
        onClick={onClick}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files[0]; if (f) onChange(f);
        }}
        className="relative h-32 rounded-xl flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-200"
        style={{
          border: `1.5px dashed ${dragging ? 'rgba(255,107,43,0.6)' : 'var(--border-2)'}`,
          background: dragging ? 'rgba(255,107,43,0.06)' : 'var(--surface)',
        }}
      >
        {preview ? (
          <img src={preview} alt={label}
            className="absolute inset-0 w-full h-full object-cover rounded-xl" />
        ) : (
          <>
            <Upload size={18} style={{ color: 'var(--muted)' }} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>Click or drag to upload</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files && onChange(e.target.files[0])} />
      </div>
    </div>
  );
}

export default function SampradayasPage() {
  const [sampradayas, setSampradayas] = useState<Sampraday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SampradayForm>(EMPTY_FORM);
  const [previewUrls, setPreviewUrls] = useState<{ hero?: string; thumbnail?: string }>({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Sampraday | null>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSampradayas(); }, []);

  const fetchSampradayas = async () => {
    setLoading(true);
    try {
      const r = await api.get('/sampradayas');
      setSampradayas(r.data?.data || r.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleImageSelect = (type: 'hero' | 'thumbnail', file: File) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      setPreviewUrls(p => ({ ...p, [type]: reader.result as string }));
    reader.readAsDataURL(file);
    setFormData(p => ({
      ...p,
      [type === 'hero' ? 'heroImageFile' : 'thumbnailImageFile']: file,
    }));
  };

  const uploadImages = async (id: string) => {
    setUploading(true);
    try {
      if (formData.heroImageFile) {
        const fd = new FormData();
        fd.append('file', formData.heroImageFile);
        await api.post(`/sampradayas/${id}/upload-image?type=hero`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      if (formData.thumbnailImageFile) {
        const fd = new FormData();
        fd.append('file', formData.thumbnailImageFile);
        await api.post(`/sampradayas/${id}/upload-image?type=thumbnail`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
    } finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { heroImageFile, thumbnailImageFile, ...body } = formData;
      if (editingId) {
        await api.patch(`/sampradayas/${editingId}`, body);
        if (heroImageFile || thumbnailImageFile) await uploadImages(editingId);
      } else {
        const res = await api.post('/sampradayas', body);
        const newId = res.data?.id || res.data?.data?.id;
        if ((heroImageFile || thumbnailImageFile) && newId) await uploadImages(newId);
      }
      closeForm();
      fetchSampradayas();
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/sampradayas/${id}`);
      fetchSampradayas();
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleEdit = (s: Sampraday) => {
    setEditingId(s.id);
    setFormData({
      ...EMPTY_FORM,
      slug: s.slug,
      nameKey: s.nameKey,
      isPublished: s.isPublished,
      displayOrder: s.displayOrder,
    });
    setPreviewUrls({ hero: s.heroImageUrl, thumbnail: s.thumbnailUrl });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setPreviewUrls({});
  };

  const field = (key: keyof SampradayForm) => ({
    value: formData[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData(p => ({ ...p, [key]: e.target.value })),
  });

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <BookOpen size={15} style={{ color: '#4ade80' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Sampradayas</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage spiritual traditions</p>
            </div>
          </div>
          <button
            onClick={() => {
              setFormData(EMPTY_FORM);
              setEditingId(null);
              setPreviewUrls({});
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: 'var(--bg)',
              boxShadow: '0 4px 15px var(--accent-glow)',
            }}
          >
            <Plus size={15} /> Add Sampraday
          </button>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>

            <div className="px-6 py-4 flex items-center gap-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <Globe2 size={15} style={{ color: '#4ade80' }} />
              <span className="font-bold text-theme text-sm">All Traditions</span>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                  {sampradayas.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} />)}
              </div>
            ) : sampradayas.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3" style={{ fontFamily: 'serif', opacity: 0.3 }}>ॐ</div>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  No sampradayas yet — add the first one
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Name</th>
                      <th className="table-header">Hero Image</th>
                      <th className="table-header">Members</th>
                      <th className="table-header">Groups</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampradayas.map((s, i) => (
                      <tr key={s.id} className="table-row" style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            {s.thumbnailUrl ? (
                              <img src={s.thumbnailUrl} alt={s.nameKey}
                                className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
                                {s.nameKey[0]?.toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-theme text-sm block">{s.nameKey}</span>
                              <code className="text-[10px]" style={{ color: 'var(--muted)' }}>{s.slug}</code>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell">
                          {s.heroImageUrl ? (
                            <img src={s.heroImageUrl} alt="hero"
                              className="w-16 h-10 rounded-lg object-cover" />
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <Users size={12} style={{ color: 'var(--muted)' }} />
                            <span className="font-semibold text-theme text-sm">
                              {(s._count?.followers ?? s.followerCount ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <LayoutGrid size={12} style={{ color: 'var(--muted)' }} />
                            <span className="font-semibold text-theme text-sm">
                              {(s._count?.groups ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className={s.isPublished ? 'badge badge-green' : 'badge badge-amber'}>
                            {s.isPublished ? '● Published' : '○ Draft'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleEdit(s)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.08)'; }}>
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setConfirmDelete(s)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)'; }}>
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
      </main>

      {/* Create/Edit modal */}
      {showForm && (
        <Modal title={editingId ? 'Edit Sampraday' : 'Add Sampraday'} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Slug *</label>
                <input {...field('slug')} type="text" placeholder="vaishnavism"
                  className="input-field" required disabled={!!editingId} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Name Key *</label>
                <input {...field('nameKey')} type="text"
                  placeholder="sampraday.vaishnavism.name" className="input-field" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--muted)' }}>Description Key</label>
              <textarea {...field('descriptionKey')}
                placeholder="sampraday.vaishnavism.description" className="input-field" rows={2} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Founder Key</label>
                <input {...field('founderKey')} type="text"
                  className="input-field" placeholder="sampraday.founder" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Primary Deity Key</label>
                <input {...field('primaryDeityKey')} type="text"
                  className="input-field" placeholder="sampraday.deity" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Founding Year</label>
                <input {...field('foundingYear')} type="number" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Display Order</label>
                <input {...field('displayOrder')} type="number" className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UploadZone label="Hero Image" preview={previewUrls.hero}
                onClick={() => heroRef.current?.click()} inputRef={heroRef}
                onChange={f => handleImageSelect('hero', f)} />
              <UploadZone label="Thumbnail Image" preview={previewUrls.thumbnail}
                onClick={() => thumbRef.current?.click()} inputRef={thumbRef}
                onChange={f => handleImageSelect('thumbnail', f)} />
            </div>

            <button type="button"
              onClick={() => setFormData(p => ({ ...p, isPublished: !p.isPublished }))}
              className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-200"
              style={{
                background: formData.isPublished ? 'rgba(74,222,128,0.08)' : 'var(--surface)',
                border: `1px solid ${formData.isPublished ? 'rgba(74,222,128,0.25)' : 'var(--border-2)'}`,
              }}>
              <div className="w-10 h-5 rounded-full relative transition-all duration-200 flex-shrink-0"
                style={{ background: formData.isPublished ? '#4ade80' : 'var(--border-2)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
                  style={{ left: formData.isPublished ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
              <span className="text-sm font-semibold"
                style={{ color: formData.isPublished ? '#4ade80' : 'var(--muted)' }}>
                {formData.isPublished ? 'Published' : 'Draft — not visible to users'}
              </span>
            </button>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting || uploading}
                className="flex items-center gap-2 flex-1 justify-center px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  color: 'var(--bg)',
                  boxShadow: '0 4px 15px var(--accent-glow)',
                }}>
                {submitting || uploading
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <Check size={14} />}
                {submitting || uploading ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={closeForm}
                className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <Modal title="Delete Sampraday" onClose={() => setConfirmDelete(null)}>
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
              <BookOpen size={15} />
            </div>
            <span className="font-semibold text-theme text-sm">{confirmDelete.nameKey}</span>
          </div>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Deleting this sampraday will unlink all associated followers and groups.
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleDelete(confirmDelete.id)}
              disabled={deletingId === confirmDelete.id}
              className="btn-danger flex-1 disabled:opacity-50">
              {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete Sampraday'}
            </button>
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
