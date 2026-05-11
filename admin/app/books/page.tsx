'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Plus, Trash2, Edit2, Search, BookOpen, X, Check, Upload, ChevronLeft, ChevronRight, FileJson } from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author?: string;
  _count?: { chapters: number; verses: number };
  isPublished: boolean;
  updatedAt: string;
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
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Book | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const take = 20;

  useEffect(() => { fetchBooks(); }, [skip, search]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const r = await api.get('/books', { params: { skip, take, search: search || undefined } });
      const d = r.data;
      setBooks(Array.isArray(d) ? d : d?.data || []);
      setTotal(d?.total ?? (Array.isArray(d) ? d.length : 0));
    } catch { } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.delete(`/books/${id}`); fetchBooks(); } catch { }
    finally { setDeletingId(null); setConfirmDelete(null); }
  };

  const handleImport = async () => {
    setImportError('');
    let parsed: unknown;
    try { parsed = JSON.parse(importJson); } catch { setImportError('Invalid JSON'); return; }
    setImporting(true);
    try {
      await api.post('/books/import', parsed);
      setShowImport(false); setImportJson('');
      fetchBooks();
    } catch (e: any) {
      setImportError(e?.response?.data?.message || 'Import failed');
    } finally { setImporting(false); }
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
              <BookOpen size={15} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Books</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage Vedic texts and scriptures</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
              <FileJson size={14} /> Bulk Import JSON
            </button>
            <Link href="/books/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
              <Plus size={15} /> New Book
            </Link>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-6">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSkip(0); }}
              placeholder="Search books by title or author…"
              className="input-field pl-10"
            />
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <BookOpen size={15} style={{ color: '#60a5fa' }} />
              <span className="font-bold text-theme text-sm">All Books</span>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                  {total}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
            ) : books.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.3 }} />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No books found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Title</th>
                      <th className="table-header">Author</th>
                      <th className="table-header">Chapters</th>
                      <th className="table-header">Verses</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Last Updated</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((b, i) => (
                      <tr key={b.id} className="table-row" style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="table-cell">
                          <Link href={`/books/${b.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                              {b.title?.[0]?.toUpperCase() || 'B'}
                            </div>
                            <span className="font-semibold text-theme text-sm">{b.title}</span>
                          </Link>
                        </td>
                        <td className="table-cell">
                          <span className="text-sm" style={{ color: 'var(--muted)' }}>{b.author || '—'}</span>
                        </td>
                        <td className="table-cell">
                          <span className="font-semibold text-theme">{b._count?.chapters ?? '—'}</span>
                        </td>
                        <td className="table-cell">
                          <span className="font-semibold text-theme">{b._count?.verses ?? '—'}</span>
                        </td>
                        <td className="table-cell">
                          <span className={b.isPublished ? 'badge badge-green' : 'badge badge-amber'}>
                            {b.isPublished ? '● Published' : '○ Draft'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {new Date(b.updatedAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/books/${b.id}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                              <Edit2 size={13} />
                            </Link>
                            <button onClick={() => setConfirmDelete(b)}
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

            {/* Pagination */}
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

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <Modal title="Delete Book" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{confirmDelete.title}</strong>?
            This will remove all associated chapters and verses. This action cannot be undone.
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

      {/* Bulk Import modal */}
      {showImport && (
        <Modal title="Bulk Import Books (JSON)" onClose={() => { setShowImport(false); setImportJson(''); setImportError(''); }}>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            Paste a JSON array of book objects. Each object should include title, author, and optionally chapters with verses.
          </p>
          <textarea
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
            rows={10}
            placeholder={'[\n  {\n    "title": "Bhagavad Gita",\n    "author": "Vyasa"\n  }\n]'}
            className="input-field font-mono text-xs mb-3"
          />
          {importError && (
            <p className="text-xs mb-3" style={{ color: '#f87171' }}>{importError}</p>
          )}
          <div className="flex gap-3">
            <button onClick={handleImport} disabled={importing || !importJson.trim()}
              className="btn-primary flex-1 disabled:opacity-50">
              {importing ? 'Importing…' : 'Import'}
            </button>
            <button onClick={() => { setShowImport(false); setImportJson(''); setImportError(''); }}
              className="btn-secondary flex-1">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
