'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { ArrowLeft, Save, Search, Upload, Mic2, X } from 'lucide-react';

interface Verse {
  id: string;
  verseNumber: string | number;
  book?: { title: string };
  chapterNumber?: number;
  sanskrit?: string;
}

interface NarrationDetail {
  id: string;
  saint: string;
  saintImageUrl?: string;
  sourceText: string;
  isPublished: boolean;
  verse?: Verse;
  verseId?: string;
  languageTexts?: Record<string, string>;
}

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'sa', label: 'Sanskrit' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'mr', label: 'Marathi' },
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

export default function NarrationEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === 'new';

  const [narration, setNarration] = useState<NarrationDetail>({
    id: '', saint: '', sourceText: '', isPublished: false, languageTexts: {},
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [activeTab, setActiveTab] = useState('en');
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [verseSearch, setVerseSearch] = useState('');
  const [verseResults, setVerseResults] = useState<Verse[]>([]);
  const [searchingVerses, setSearchingVerses] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew) fetchNarration();
  }, [id]);

  const fetchNarration = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/narrations/${id}`);
      const d = r.data;
      setNarration({
        ...d,
        languageTexts: d.languageTexts || {},
      });
      if (d.saintImageUrl) setImagePreview(d.saintImageUrl);
      if (d.verse) setVerseSearch(`${d.verse.book?.title || ''} ${d.verse.verseNumber}`);
    } catch { } finally { setLoading(false); }
  };

  const searchVerses = async () => {
    if (!verseSearch.trim()) return;
    setSearchingVerses(true);
    try {
      const r = await api.get('/verses', { params: { search: verseSearch, take: 10 } });
      const d = r.data;
      setVerseResults(Array.isArray(d) ? d : d?.data || []);
    } catch { } finally { setSearchingVerses(false); }
  };

  const selectVerse = (v: Verse) => {
    setNarration(n => ({ ...n, verseId: v.id, verse: v }));
    setVerseSearch(`${v.book?.title ? v.book.title + ' · ' : ''}Verse ${v.verseNumber}`);
    setVerseResults([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _, verse: __, saintImageUrl: ___, ...body } = narration as any;
      let savedId = id;
      if (isNew) {
        const r = await api.post('/narrations', body);
        savedId = r.data?.id || r.data?.data?.id;
      } else {
        await api.patch(`/narrations/${id}`, body);
      }
      if (imageFile && savedId) {
        const fd = new FormData();
        fd.append('file', imageFile);
        await api.post(`/narrations/${savedId}/upload-saint-image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      if (isNew) router.push(`/narrations/${savedId}`);
    } catch { } finally { setSaving(false); }
  };

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const setLangText = (code: string, text: string) =>
    setNarration(n => ({ ...n, languageTexts: { ...n.languageTexts, [code]: text } }));

  const update = (key: keyof NarrationDetail, val: string | boolean) =>
    setNarration(n => ({ ...n, [key]: val }));

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-4 max-w-4xl mx-auto">
            {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
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
            <Link href="/narrations"
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
              <ArrowLeft size={14} />
            </Link>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <Mic2 size={15} style={{ color: '#a855f7' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">
                {isNew ? 'New Narration' : (narration.saint || 'Edit Narration')}
              </h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {isNew ? 'Create a new saint narration' : 'Edit narration details'}
              </p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Narration'}
          </button>
        </header>

        <div className="p-8 max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Saint info */}
            <div className="space-y-4">
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Saint Image</label>
                <div onClick={() => imageRef.current?.click()}
                  className="relative rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer mb-4"
                  style={{ height: '160px', border: '1.5px dashed var(--border-2)', background: 'var(--surface)' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Saint" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload size={18} style={{ color: 'var(--muted)' }} />
                      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Upload saint photo</p>
                    </>
                  )}
                  <input ref={imageRef} type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files && handleImageSelect(e.target.files[0])} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Saint Name</label>
                  <input value={narration.saint}
                    onChange={e => update('saint', e.target.value)}
                    className="input-field" placeholder="e.g. Prabhupada, Ramanujacharya" />
                </div>
              </div>

              {/* Source citation */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Source Citation <span style={{ color: '#f87171' }}>*</span>
                </label>
                <textarea value={narration.sourceText}
                  onChange={e => update('sourceText', e.target.value)}
                  rows={3} className="input-field"
                  placeholder="Book title, chapter, page number…" required />
              </div>

              {/* Published */}
              <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
                style={{
                  background: narration.isPublished ? 'rgba(74,222,128,0.06)' : 'var(--surface)',
                  border: `1px solid ${narration.isPublished ? 'rgba(74,222,128,0.2)' : 'var(--border)'}`,
                }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: narration.isPublished ? '#4ade80' : 'var(--text)' }}>
                    {narration.isPublished ? 'Published' : 'Draft'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Visible to users</p>
                </div>
                <ToggleSwitch checked={narration.isPublished} onChange={v => update('isPublished', v)} />
              </div>
            </div>

            {/* Main content */}
            <div className="lg:col-span-2 space-y-5">

              {/* Verse search */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Linked Verse</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                    <input
                      value={verseSearch}
                      onChange={e => setVerseSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchVerses()}
                      className="input-field pl-9"
                      placeholder="Search by verse text or book name…"
                    />
                  </div>
                  <button onClick={searchVerses} disabled={searchingVerses}
                    className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                    {searchingVerses ? '…' : 'Search'}
                  </button>
                  {narration.verseId && (
                    <button onClick={() => { setNarration(n => ({ ...n, verseId: undefined, verse: undefined })); setVerseSearch(''); }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                {verseResults.length > 0 && (
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-2)' }}>
                    {verseResults.map(v => (
                      <button key={v.id} onClick={() => selectVerse(v)}
                        className="w-full px-4 py-3 text-left hover:opacity-80 transition-opacity"
                        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <p className="text-sm font-semibold text-theme">
                          {v.book?.title ? `${v.book.title} · ` : ''}Verse {v.verseNumber}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)', fontFamily: 'serif' }}>
                          {v.sanskrit || ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {narration.verseId && (
                  <p className="text-xs mt-2" style={{ color: '#4ade80' }}>
                    ● Linked to verse
                  </p>
                )}
              </div>

              {/* Language content tabs */}
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {LANGS.map(lang => {
                  const hasContent = !!(narration.languageTexts || {})[lang.code];
                  return (
                    <button key={lang.code} onClick={() => setActiveTab(lang.code)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 relative"
                      style={{
                        background: activeTab === lang.code ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'transparent',
                        color: activeTab === lang.code ? 'var(--bg)' : hasContent ? 'var(--text)' : 'var(--muted)',
                      }}>
                      {lang.label}
                      {hasContent && activeTab !== lang.code && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Commentary — {LANGS.find(l => l.code === activeTab)?.label}
                </label>
                <textarea
                  value={(narration.languageTexts || {})[activeTab] || ''}
                  onChange={e => setLangText(activeTab, e.target.value)}
                  rows={10}
                  className="input-field"
                  placeholder={`Enter commentary in ${LANGS.find(l => l.code === activeTab)?.label}…`}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
