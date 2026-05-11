'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Globe2, Plus, X, Check, AlignRight } from 'lucide-react';

interface Language {
  id: string;
  code: string;
  nativeName: string;
  englishName: string;
  isRtl: boolean;
  isActive: boolean;
  fallbackCode: string | null;
  updatedAt: string;
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
  code: '', nativeName: '', englishName: '', isRtl: false, isActive: true, fallbackCode: '',
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-10 h-5 rounded-full relative flex-shrink-0 transition-all duration-200"
      style={{ background: checked ? '#4ade80' : 'var(--border-2)' }}>
      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
        style={{ left: checked ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

function Skeleton() {
  return <div className="skeleton h-14 rounded-xl" />;
}

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<LangForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { fetchLanguages(); }, []);

  const fetchLanguages = async () => {
    try {
      const r = await api.get('/languages');
      setLanguages(r.data || generateMockLanguages());
    } catch {
      setLanguages(generateMockLanguages());
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/languages', {
        code: form.code,
        nativeName: form.nativeName,
        englishName: form.englishName,
        isRtl: form.isRtl,
        isActive: form.isActive,
        fallbackCode: form.fallbackCode || null,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchLanguages();
    } catch (e) {
      console.error('Failed to add language:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (lang: Language) => {
    setTogglingId(lang.id);
    try {
      await api.patch(`/languages/${lang.id}`, { isActive: !lang.isActive });
      setLanguages(prev => prev.map(l => l.id === lang.id ? { ...l, isActive: !l.isActive } : l));
    } catch {
      console.error('Toggle failed');
    } finally {
      setTogglingId(null);
    }
  };

  const field = (key: keyof LangForm) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Header */}
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
          <button
            onClick={() => { setShowModal(true); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Plus size={15} /> Add Language
          </button>
        </header>

        <div className="p-8 max-w-5xl mx-auto">

          {/* Table */}
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
                      <th className="table-header">Last Updated</th>
                      <th className="table-header">Active</th>
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
                          <span className="font-semibold text-theme">{lang.nativeName}</span>
                        </td>
                        <td className="table-cell">
                          <span style={{ color: 'var(--muted)' }}>{lang.englishName}</span>
                        </td>
                        <td className="table-cell">
                          {lang.isRtl ? (
                            <div className="flex items-center gap-1.5">
                              <span className="badge badge-amber">
                                <AlignRight size={9} className="mr-1" /> RTL
                              </span>
                            </div>
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
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {new Date(lang.updatedAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="table-cell">
                          {togglingId === lang.id ? (
                            <div className="w-4 h-4 rounded-full border-2 border-green-400 border-t-transparent animate-spin" />
                          ) : (
                            <Toggle checked={lang.isActive} onChange={() => handleToggleActive(lang)} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Add Language Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <div className="rounded-2xl w-full max-w-md animate-scale-in overflow-hidden"
              style={{ background: 'var(--bg-2)', border: '1px solid rgba(255,107,43,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

              <div className="px-6 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,107,43,0.05)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full" style={{ background: 'linear-gradient(var(--accent), var(--accent-2))' }} />
                  <h2 className="font-bold text-theme">Add Language</h2>
                </div>
                <button onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                  style={{ background: 'var(--border)', color: 'var(--muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                      Language Code *
                    </label>
                    <input {...field('code')} type="text" placeholder="hi" maxLength={10}
                      className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                      Fallback Code
                    </label>
                    <input {...field('fallbackCode')} type="text" placeholder="en" maxLength={10}
                      className="input-field" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                    Native Name *
                  </label>
                  <input {...field('nativeName')} type="text" placeholder="हिन्दी" className="input-field" required />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                    English Name *
                  </label>
                  <input {...field('englishName')} type="text" placeholder="Hindi" className="input-field" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* RTL toggle */}
                  <button type="button" onClick={() => setForm(p => ({ ...p, isRtl: !p.isRtl }))}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200"
                    style={{
                      background: form.isRtl ? 'rgba(251,191,36,0.08)' : 'var(--surface)',
                      border: `1px solid ${form.isRtl ? 'rgba(251,191,36,0.25)' : 'var(--border-2)'}`,
                    }}>
                    <Toggle checked={form.isRtl} onChange={v => setForm(p => ({ ...p, isRtl: v }))} />
                    <span className="text-sm font-semibold" style={{ color: form.isRtl ? '#fbbf24' : 'var(--muted)' }}>RTL</span>
                  </button>

                  {/* Active toggle */}
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

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
                    {submitting
                      ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                      : <Check size={14} />
                    }
                    {submitting ? 'Adding…' : 'Add Language'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-5 py-2.5 text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function generateMockLanguages(): Language[] {
  const langs = [
    { code: 'en', nativeName: 'English', englishName: 'English', isRtl: false, isActive: true, fallbackCode: null },
    { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', isRtl: false, isActive: true, fallbackCode: 'en' },
    { code: 'sa', nativeName: 'संस्कृतम्', englishName: 'Sanskrit', isRtl: false, isActive: true, fallbackCode: 'en' },
    { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', isRtl: false, isActive: true, fallbackCode: 'hi' },
    { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', isRtl: false, isActive: true, fallbackCode: 'hi' },
    { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', isRtl: false, isActive: true, fallbackCode: 'en' },
    { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', isRtl: false, isActive: true, fallbackCode: 'en' },
    { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', isRtl: false, isActive: false, fallbackCode: 'en' },
    { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', isRtl: false, isActive: false, fallbackCode: 'en' },
    { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', isRtl: true, isActive: false, fallbackCode: 'en' },
  ];
  return langs.map((l, i) => ({
    ...l,
    id: `lang_${i + 1}`,
    updatedAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
  }));
}
