'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Save, ArrowLeft, Upload, BookOpen, ChevronRight, Plus } from 'lucide-react';

interface Chapter {
  id: string;
  number: number;
  title?: string;
  _count?: { verses: number };
}

interface BookDetail {
  id: string;
  title: string;
  titleHi?: string;
  titleSa?: string;
  description?: string;
  descriptionHi?: string;
  descriptionSa?: string;
  author?: string;
  isPublished: boolean;
  coverImageUrl?: string;
  chapters?: Chapter[];
}

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'sa', label: 'Sanskrit' },
];

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-10 h-5 rounded-full relative transition-all duration-200 flex-shrink-0"
      style={{ background: checked ? '#4ade80' : 'var(--border-2)' }}>
      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
        style={{ left: checked ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

export default function BookEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === 'new';

  const [book, setBook] = useState<BookDetail>({
    id: '', title: '', titleHi: '', titleSa: '',
    description: '', descriptionHi: '', descriptionSa: '',
    author: '', isPublished: false,
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('en');
  const [coverPreview, setCoverPreview] = useState<string | undefined>();
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew) fetchBook();
  }, [id]);

  const fetchBook = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/books/${id}`);
      const d = r.data;
      setBook(d);
      setChapters(d.chapters || []);
      if (d.coverImageUrl) setCoverPreview(d.coverImageUrl);
    } catch { } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _, chapters: __, coverImageUrl: ___, ...body } = book as any;
      let savedId = id;
      if (isNew) {
        const r = await api.post('/books', body);
        savedId = r.data?.id || r.data?.data?.id;
      } else {
        await api.patch(`/books/${id}`, body);
      }
      if (coverFile && savedId) {
        setUploadingCover(true);
        const fd = new FormData();
        fd.append('file', coverFile);
        await api.post(`/books/${savedId}/upload-cover`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUploadingCover(false);
      }
      if (isNew) router.push(`/books/${savedId}`);
    } catch { } finally { setSaving(false); }
  };

  const handleCoverSelect = (file: File) => {
    setCoverFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const update = (key: keyof BookDetail, val: string | boolean) =>
    setBook(b => ({ ...b, [key]: val }));

  const titleKey = activeTab === 'en' ? 'title' : activeTab === 'hi' ? 'titleHi' : 'titleSa';
  const descKey = activeTab === 'en' ? 'description' : activeTab === 'hi' ? 'descriptionHi' : 'descriptionSa';

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-4 max-w-3xl mx-auto">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <Link href="/books"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
              <ArrowLeft size={14} />
            </Link>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <BookOpen size={15} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">{isNew ? 'New Book' : (book.title || 'Edit Book')}</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{isNew ? 'Create a new scripture' : 'Edit book details'}</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || uploadingCover}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Save size={14} />
            {saving || uploadingCover ? 'Saving…' : 'Save Book'}
          </button>
        </header>

        <div className="p-8 max-w-4xl mx-auto space-y-6">

          {/* Language tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {LANGS.map(lang => (
              <button key={lang.code} onClick={() => setActiveTab(lang.code)}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  background: activeTab === lang.code ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'transparent',
                  color: activeTab === lang.code ? 'var(--bg)' : 'var(--muted)',
                }}>
                {lang.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main fields */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                    Title ({LANGS.find(l => l.code === activeTab)?.label})
                  </label>
                  <input
                    value={(book[titleKey as keyof BookDetail] as string) || ''}
                    onChange={e => update(titleKey as keyof BookDetail, e.target.value)}
                    placeholder={`Title in ${LANGS.find(l => l.code === activeTab)?.label}`}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                    Description ({LANGS.find(l => l.code === activeTab)?.label})
                  </label>
                  <textarea
                    value={(book[descKey as keyof BookDetail] as string) || ''}
                    onChange={e => update(descKey as keyof BookDetail, e.target.value)}
                    placeholder={`Description in ${LANGS.find(l => l.code === activeTab)?.label}`}
                    className="input-field"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Author</label>
                  <input
                    value={book.author || ''}
                    onChange={e => update('author', e.target.value)}
                    placeholder="e.g. Vyasa, Valmiki"
                    className="input-field"
                  />
                </div>
              </div>

              {/* Published toggle */}
              <div className="rounded-2xl px-6 py-4 flex items-center justify-between"
                style={{
                  background: book.isPublished ? 'rgba(74,222,128,0.06)' : 'var(--surface)',
                  border: `1px solid ${book.isPublished ? 'rgba(74,222,128,0.2)' : 'var(--border)'}`,
                }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: book.isPublished ? '#4ade80' : 'var(--text)' }}>
                    {book.isPublished ? 'Published' : 'Draft'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {book.isPublished ? 'Visible to all users' : 'Not visible to users'}
                  </p>
                </div>
                <ToggleSwitch checked={book.isPublished} onChange={v => update('isPublished', v)} />
              </div>
            </div>

            {/* Cover image */}
            <div className="space-y-4">
              <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Cover Image</label>
                <div
                  onClick={() => coverRef.current?.click()}
                  className="relative rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
                  style={{
                    height: '200px',
                    border: '1.5px dashed var(--border-2)',
                    background: 'var(--surface)',
                  }}>
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload size={18} style={{ color: 'var(--muted)' }} />
                      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Click to upload cover</p>
                    </>
                  )}
                  <input ref={coverRef} type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files && handleCoverSelect(e.target.files[0])} />
                </div>
              </div>
            </div>
          </div>

          {/* Chapters table */}
          {!isNew && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-theme text-sm">Chapters</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                    {chapters.length}
                  </span>
                </div>
              </div>
              {chapters.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>No chapters yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Chapter</th>
                      <th className="table-header">Title</th>
                      <th className="table-header">Verses</th>
                      <th className="table-header"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {chapters.map((ch, i) => (
                      <tr key={ch.id} className="table-row">
                        <td className="table-cell">
                          <span className="font-semibold text-theme">Ch. {ch.number}</span>
                        </td>
                        <td className="table-cell">
                          <span className="text-sm" style={{ color: 'var(--muted)' }}>{ch.title || '—'}</span>
                        </td>
                        <td className="table-cell">
                          <span className="font-semibold text-theme">{ch._count?.verses ?? '—'}</span>
                        </td>
                        <td className="table-cell">
                          <Link href={`/books/${id}/chapters/${ch.number}`}
                            className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                            style={{ color: '#60a5fa' }}>
                            View Verses <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
