'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Plus, Trash2, Edit2, Search, BookOpen, X, ChevronLeft, ChevronRight, Upload, Check, Filter } from 'lucide-react';

interface Book {
  id: string;
  bookNumber?: number;
  slug?: string;
  title?: string;
  titleKey?: string;
  descriptionKey?: string;
  description?: string;
  coverImageUrl?: string;
  author?: string;
  totalChapters?: number;
  totalVerses?: number;
  isPublished: boolean;
  updatedAt: string;
  _count?: { chapters: number; verses: number };
}

interface BookForm {
  bookNumber: string;
  slug: string;
  titleKey: string;
  descriptionKey: string;
  isPublished: boolean;
  coverImageFile?: File;
  coverPreview?: string;
}

const EMPTY_FORM: BookForm = {
  bookNumber: '1', slug: '', titleKey: '', descriptionKey: '', isPublished: false,
};

const SCRIPTURE_TYPES = [
  { value: '1', label: 'BG', fullLabel: 'Bhagavad Gita', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
  { value: '2', label: 'SB', fullLabel: 'Srimad Bhagavatam', color: '#0369a1', bg: 'rgba(3,105,161,0.12)', border: 'rgba(3,105,161,0.25)' },
  { value: '3', label: 'Ram', fullLabel: 'Ramayana', color: '#9f1239', bg: 'rgba(159,18,57,0.12)', border: 'rgba(159,18,57,0.25)' },
];

function getScriptureType(bookNumber?: number) {
  const st = SCRIPTURE_TYPES.find(t => t.value === String(bookNumber));
  return st ?? { label: `#${bookNumber ?? '?'}`, fullLabel: 'Unknown', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' };
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

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Book | null>(null);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<BookForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const take = 20;

  useEffect(() => { fetchBooks(); }, [skip, search, filterType]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const r = await api.get('/books', { params: { skip, take, search: search || undefined } });
      const d = r.data;
      let list: Book[] = Array.isArray(d) ? d : d?.data || [];
      if (filterType) list = list.filter(b => String(b.bookNumber) === filterType);
      setBooks(list);
      setTotal(d?.total ?? list.length);
    } catch { } finally { setLoading(false); }
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditBook(null); setShowCreate(true); };
  const openEdit = (b: Book) => {
    setEditBook(b);
    setForm({
      bookNumber: String(b.bookNumber ?? '1'),
      slug: b.slug ?? '',
      titleKey: b.titleKey ?? b.title ?? '',
      descriptionKey: b.descriptionKey ?? b.description ?? '',
      isPublished: b.isPublished,
      coverPreview: b.coverImageUrl,
    });
    setShowCreate(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        bookNumber: Number(form.bookNumber),
        slug: form.slug,
        titleKey: form.titleKey,
        descriptionKey: form.descriptionKey || undefined,
        isPublished: form.isPublished,
      };
      if (form.coverImageFile) {
        const fd = new FormData();
        fd.append('file', form.coverImageFile);
        const up = await api.post('/books/upload-cover', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.coverImageUrl = up.data?.url;
      }
      if (editBook) {
        await api.patch(`/books/${editBook.id}`, payload);
      } else {
        await api.post('/books', payload);
      }
      setShowCreate(false);
      fetchBooks();
    } catch { } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.delete(`/books/${id}`); fetchBooks(); } catch { }
    finally { setDeletingId(null); setConfirmDelete(null); }
  };

  const pages = Math.ceil(total / take);
  const currentPage = Math.floor(skip / take) + 1;
  const displayTitle = (b: Book) => b.title || b.titleKey || 'Untitled';

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <BookOpen size={15} style={{ color: '#f97316' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Books</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage Vedic texts and scriptures</p>
            </div>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', boxShadow: '0 4px 15px rgba(249,115,22,0.4)' }}>
            <Plus size={15} /> Add Book
          </button>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-6">
          {/* Search + filter */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setSkip(0); }}
                placeholder="Search books by title…"
                className="input-field pl-10"
              />
            </div>
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
              <select value={filterType} onChange={e => { setFilterType(e.target.value); setSkip(0); }} className="select-field pl-8">
                <option value="">All Types</option>
                {SCRIPTURE_TYPES.map(st => (
                  <option key={st.value} value={st.value}>{st.label} — {st.fullLabel}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <BookOpen size={15} style={{ color: '#f97316' }} />
              <span className="font-bold text-theme text-sm">All Books</span>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                  {total}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
            ) : books.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.3 }} />
                <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>No books found</p>
                <p className="text-xs" style={{ color: 'var(--muted)', opacity: 0.6 }}>Add your first Vedic scripture to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Title</th>
                      <th className="table-header">Type</th>
                      <th className="table-header">Chapters</th>
                      <th className="table-header">Verses</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((b, i) => {
                      const st = getScriptureType(b.bookNumber);
                      return (
                        <tr key={b.id} className="table-row" style={{ animationDelay: `${i * 30}ms` }}>
                          <td className="table-cell">
                            <Link href={`/books/${b.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                              {b.coverImageUrl ? (
                                <img src={b.coverImageUrl} alt={displayTitle(b)}
                                  className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                                  {displayTitle(b)[0]?.toUpperCase() || 'B'}
                                </div>
                              )}
                              <span className="font-semibold text-theme text-sm">{displayTitle(b)}</span>
                            </Link>
                          </td>
                          <td className="table-cell">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                              style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                              {st.label}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className="font-semibold text-theme">
                              {b._count?.chapters ?? b.totalChapters ?? '—'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className="font-semibold text-theme">
                              {b._count?.verses ?? b.totalVerses ?? '—'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className={b.isPublished ? 'badge badge-green' : 'badge badge-amber'}>
                              {b.isPublished ? '● Published' : '○ Draft'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openEdit(b)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                                style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => setConfirmDelete(b)}
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
                  Page {currentPage} of {pages} · {total} books
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

      {/* Create / Edit modal */}
      {showCreate && (
        <Modal title={editBook ? 'Edit Book' : 'Add Book'} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type dropdown */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Scripture Type *
              </label>
              <select
                value={form.bookNumber}
                onChange={e => setForm(p => ({ ...p, bookNumber: e.target.value }))}
                className="select-field" required>
                {SCRIPTURE_TYPES.map(st => (
                  <option key={st.value} value={st.value}>{st.label} — {st.fullLabel}</option>
                ))}
                <option value="99">Other</option>
              </select>
            </div>

            {/* Title (i18n key) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Title Key *
              </label>
              <input
                value={form.titleKey}
                onChange={e => setForm(p => ({ ...p, titleKey: e.target.value }))}
                placeholder="e.g. bhagavad-gita.title"
                className="input-field" required />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Slug *
              </label>
              <input
                value={form.slug}
                onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                placeholder="e.g. bhagavad-gita"
                className="input-field" required />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Description Key
              </label>
              <input
                value={form.descriptionKey}
                onChange={e => setForm(p => ({ ...p, descriptionKey: e.target.value }))}
                placeholder="e.g. bhagavad-gita.description"
                className="input-field" />
            </div>

            {/* Cover image upload */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Cover Image
              </label>
              <div
                onClick={() => coverRef.current?.click()}
                className="relative h-28 rounded-xl flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-200"
                style={{ border: '1.5px dashed var(--border-2)', background: 'var(--surface)' }}>
                {form.coverPreview ? (
                  <img src={form.coverPreview} alt="cover" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                ) : (
                  <>
                    <Upload size={18} style={{ color: 'var(--muted)' }} />
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>Click to upload cover image</p>
                  </>
                )}
                <input ref={coverRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setForm(p => ({ ...p, coverImageFile: f, coverPreview: URL.createObjectURL(f) }));
                  }} />
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
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 flex-1 justify-center px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', boxShadow: '0 4px 15px rgba(249,115,22,0.35)' }}>
                {submitting
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <Check size={14} />}
                {submitting ? 'Saving…' : editBook ? 'Save Changes' : 'Add Book'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <Modal title="Delete Book" onClose={() => setConfirmDelete(null)}>
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
              <BookOpen size={15} />
            </div>
            <span className="font-semibold text-theme text-sm">{displayTitle(confirmDelete)}</span>
          </div>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Deleting this book will remove all associated chapters and verses. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => handleDelete(confirmDelete.id)} disabled={deletingId === confirmDelete.id}
              className="btn-danger flex-1 disabled:opacity-50">
              {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete Book'}
            </button>
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
