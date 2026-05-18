'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  Plus, Search, Filter, Eye, BookOpen, X, Check,
  ChevronLeft, ChevronRight, Languages,
} from 'lucide-react';

interface Book {
  id: string;
  titleKey?: string;
  title?: string;
  bookNumber?: number;
}

interface Translation {
  languageCode: string;
  text: string;
}

interface Verse {
  id: string;
  verseNumber: number | string;
  chapterNumber?: number;
  sanskrit: string;
  transliteration?: string;
  meaning?: string;
  book?: Book;
  translations?: Translation[];
  _count?: { translations: number };
}

interface VerseForm {
  verseNumber: string;
  chapterNumber: string;
  bookId: string;
  sanskrit: string;
  transliteration: string;
  meaning: string;
}

const EMPTY_FORM: VerseForm = {
  verseNumber: '', chapterNumber: '', bookId: '',
  sanskrit: '', transliteration: '', meaning: '',
};

const BOOK_TYPES = [
  { value: '1', label: 'BG', fullLabel: 'Bhagavad Gita', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
  { value: '2', label: 'SB', fullLabel: 'Srimad Bhagavatam', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)' },
  { value: '3', label: 'Ram', fullLabel: 'Ramayana', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
];

function bookLabel(bookNumber?: number) {
  return BOOK_TYPES.find(t => t.value === String(bookNumber))
    ?? { label: '?', fullLabel: 'Unknown', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' };
}

function verseRef(v: Verse) {
  const b = bookLabel(v.book?.bookNumber);
  if (v.chapterNumber)
    return `${b.label} ${v.chapterNumber}.${v.verseNumber}`;
  return `${b.label} ${v.verseNumber}`;
}

function Skeleton() {
  return <div className="skeleton h-14 rounded-xl" />;
}

function Modal({ title, onClose, wide, children }: {
  title: string; onClose: () => void; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl overflow-hidden`}
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
        <div className="p-6 max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function VersesPage() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBook, setFilterBook] = useState('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [viewVerse, setViewVerse] = useState<Verse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<VerseForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const take = 20;

  useEffect(() => { fetchBooks(); }, []);
  useEffect(() => { fetchVerses(); }, [skip, search, filterBook]);

  const fetchBooks = async () => {
    try {
      const r = await api.get('/books');
      setBooks(Array.isArray(r.data) ? r.data : r.data?.data || []);
    } catch { }
  };

  const fetchVerses = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { skip, take };
      if (search) params.search = search;
      if (filterBook) params.bookId = filterBook;
      const r = await api.get('/verses', { params });
      const d = r.data;
      setVerses(Array.isArray(d) ? d : d?.data || []);
      setTotal(d?.total ?? (Array.isArray(d) ? d.length : 0));
    } catch { } finally { setLoading(false); }
  };

  const openView = async (v: Verse) => {
    setViewVerse(v);
    if (!v.translations) {
      setViewLoading(true);
      try {
        const r = await api.get(`/verses/${v.id}`);
        setViewVerse(r.data?.data || r.data);
      } catch { } finally { setViewLoading(false); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/verses', {
        verseNumber: Number(form.verseNumber),
        chapterNumber: form.chapterNumber ? Number(form.chapterNumber) : undefined,
        bookId: form.bookId || undefined,
        sanskrit: form.sanskrit,
        transliteration: form.transliteration || undefined,
        meaning: form.meaning || undefined,
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      fetchVerses();
    } catch { } finally { setSubmitting(false); }
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
              style={{ background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)' }}>
              <BookOpen size={15} style={{ color: '#f5c842' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Verses</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Browse and manage Sanskrit verses</p>
            </div>
          </div>
          <button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: 'var(--bg)',
              boxShadow: '0 4px 15px var(--accent-glow)',
            }}>
            <Plus size={15} /> Add Verse
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
                placeholder="Search by reference, Sanskrit text, or meaning…"
                className="input-field pl-10"
              />
            </div>
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--muted)' }} />
              <select value={filterBook} onChange={e => { setFilterBook(e.target.value); setSkip(0); }}
                className="select-field pl-8">
                <option value="">All Books</option>
                {books.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title || b.titleKey || b.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <div className="px-6 py-4 flex items-center gap-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <BookOpen size={15} style={{ color: '#f5c842' }} />
              <span className="font-bold text-theme text-sm">All Verses</span>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(245,200,66,0.12)', color: '#f5c842', border: '1px solid rgba(245,200,66,0.2)' }}>
                  {total}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} />)}
              </div>
            ) : verses.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3" style={{ fontFamily: 'serif', opacity: 0.3 }}>श्लोक</div>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No verses found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Reference</th>
                      <th className="table-header">Book</th>
                      <th className="table-header">Chapter</th>
                      <th className="table-header">Sanskrit Preview</th>
                      <th className="table-header">Translations</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verses.map((v, i) => {
                      const bt = bookLabel(v.book?.bookNumber);
                      const transCount = v._count?.translations ?? v.translations?.length ?? 0;
                      return (
                        <tr key={v.id} className="table-row" style={{ animationDelay: `${i * 30}ms` }}>
                          <td className="table-cell">
                            <span className="font-bold text-sm"
                              style={{ color: bt.color }}>{verseRef(v)}</span>
                          </td>
                          <td className="table-cell">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                              style={{ background: bt.bg, color: bt.color, border: `1px solid ${bt.border}` }}>
                              {bt.label}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className="text-sm" style={{ color: 'var(--muted)' }}>
                              {v.chapterNumber ?? '—'}
                            </span>
                          </td>
                          <td className="table-cell max-w-xs">
                            <p className="text-sm truncate" style={{ fontFamily: 'serif', color: 'var(--text-2)' }}
                              title={v.sanskrit}>
                              {v.sanskrit?.slice(0, 60)}{v.sanskrit?.length > 60 ? '…' : ''}
                            </p>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              <Languages size={12} style={{ color: 'var(--muted)' }} />
                              <span className="font-semibold text-theme text-sm">{transCount}</span>
                            </div>
                          </td>
                          <td className="table-cell">
                            <button onClick={() => openView(v)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                              style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', color: '#f5c842' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,200,66,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,200,66,0.08)'; }}
                              title="View details">
                              <Eye size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pages > 1 && (
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Page {currentPage} of {pages} · {total} verses
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

      {/* Verse detail modal */}
      {viewVerse && (
        <Modal title={`Verse — ${verseRef(viewVerse)}`} onClose={() => setViewVerse(null)} wide>
          {viewLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Sanskrit</p>
                <p className="text-lg leading-relaxed"
                  style={{ fontFamily: 'serif', color: 'var(--text)' }}>
                  {viewVerse.sanskrit}
                </p>
              </div>

              {viewVerse.transliteration && (
                <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--muted)' }}>Transliteration</p>
                  <p className="text-sm leading-relaxed italic" style={{ color: 'var(--text-2)' }}>
                    {viewVerse.transliteration}
                  </p>
                </div>
              )}

              {viewVerse.meaning && (
                <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--muted)' }}>Meaning</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                    {viewVerse.meaning}
                  </p>
                </div>
              )}

              {viewVerse.translations && viewVerse.translations.length > 0 && (
                <div className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3 flex items-center gap-2"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <Languages size={13} style={{ color: 'var(--accent)' }} />
                    <span className="font-bold text-theme text-sm">Translations</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: 'rgba(255,107,43,0.1)', color: 'var(--accent)', border: '1px solid rgba(255,107,43,0.2)' }}>
                      {viewVerse.translations.length}
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {viewVerse.translations.map(t => (
                      <div key={t.languageCode} className="px-4 py-3">
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded mb-2 uppercase"
                          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                          {t.languageCode}
                        </span>
                        <p className="text-sm" style={{ color: 'var(--text)' }}>{t.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Create verse modal */}
      {showCreate && (
        <Modal title="Add Verse" onClose={() => setShowCreate(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Book</label>
                <select value={form.bookId}
                  onChange={e => setForm(p => ({ ...p, bookId: e.target.value }))}
                  className="select-field">
                  <option value="">Select book…</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title || b.titleKey}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Chapter</label>
                <input value={form.chapterNumber}
                  onChange={e => setForm(p => ({ ...p, chapterNumber: e.target.value }))}
                  type="number" min="1" placeholder="e.g. 2" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)' }}>Verse No. *</label>
                <input value={form.verseNumber}
                  onChange={e => setForm(p => ({ ...p, verseNumber: e.target.value }))}
                  type="number" min="1" placeholder="e.g. 47" className="input-field" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--muted)' }}>Sanskrit *</label>
              <textarea value={form.sanskrit}
                onChange={e => setForm(p => ({ ...p, sanskrit: e.target.value }))}
                rows={4} className="input-field"
                style={{ fontFamily: 'serif', fontSize: '16px' }}
                placeholder="Sanskrit verse text…" required />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--muted)' }}>Transliteration</label>
              <textarea value={form.transliteration}
                onChange={e => setForm(p => ({ ...p, transliteration: e.target.value }))}
                rows={3} className="input-field" placeholder="IAST transliteration…" />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--muted)' }}>Meaning</label>
              <textarea value={form.meaning}
                onChange={e => setForm(p => ({ ...p, meaning: e.target.value }))}
                rows={3} className="input-field" placeholder="English meaning / word-for-word…" />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 flex-1 justify-center px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  color: 'var(--bg)',
                  boxShadow: '0 4px 15px var(--accent-glow)',
                }}>
                {submitting
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <Check size={14} />}
                {submitting ? 'Creating…' : 'Add Verse'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
