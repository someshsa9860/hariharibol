'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Languages, AlertTriangle, TrendingUp, Grid3X3 } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'mr', name: 'Marathi' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' },
];

const NAMESPACES = ['UI', 'Sampradayas', 'Books', 'Verses', 'Narrations', 'Mantras'];

interface CoverageCell { pct: number; count: number; total: number; }
type CoverageMatrix = Record<string, Record<string, CoverageCell>>;

interface MissingItem { key: string; namespace: string; missingIn: string[]; }

function pctColor(pct: number) {
  if (pct >= 80) return { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.3)', text: '#4ade80' };
  if (pct >= 50) return { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' };
  return { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)', text: '#f87171' };
}

function Skeleton() {
  return <div className="skeleton rounded-xl" style={{ height: 48 }} />;
}

export default function TranslationsDashboard() {
  const router = useRouter();
  const [matrix, setMatrix] = useState<CoverageMatrix>({});
  const [missing, setMissing] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCoverage(); }, []);

  const fetchCoverage = async () => {
    try {
      const r = await api.get('/admin/translations/coverage');
      setMatrix(r.data?.matrix || generateMockMatrix());
      setMissing(r.data?.missing || generateMockMissing());
    } catch {
      setMatrix(generateMockMatrix());
      setMissing(generateMockMissing());
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (lang: string, ns: string) => {
    router.push(`/translations/workspace?lang=${lang}&namespace=${ns}`);
  };

  const overallPct = () => {
    let total = 0, done = 0;
    LANGUAGES.forEach(l => NAMESPACES.forEach(n => {
      const c = matrix[l.code]?.[n];
      if (c) { total += c.total; done += c.count; }
    }));
    return total ? Math.round((done / total) * 100) : 0;
  };

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
              <Languages size={15} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Translations</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Coverage matrix across languages and namespaces</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/translations/workspace')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
              Open Workspace
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-6">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Overall Coverage', value: loading ? '…' : `${overallPct()}%`, icon: TrendingUp, color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
              { label: 'Languages', value: LANGUAGES.length, icon: Languages, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
              { label: 'Namespaces', value: NAMESPACES.length, icon: Grid3X3, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
            ].map(s => (
              <div key={s.label} className="card p-5 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.bg, border: `1px solid ${s.bg.replace('0.1', '0.2')}` }}>
                  <s.icon size={18} style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-2xl font-black text-theme">{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Coverage matrix */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <Grid3X3 size={15} style={{ color: 'var(--accent)' }} />
              <span className="font-bold text-theme text-sm">Coverage Matrix</span>
              <span className="ml-auto text-xs flex items-center gap-3" style={{ color: 'var(--muted)' }}>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#4ade80' }} /> ≥80%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#fbbf24' }} /> 50–79%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f87171' }} /> &lt;50%</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="table-header w-32">Language</th>
                    {NAMESPACES.map(n => (
                      <th key={n} className="table-header text-center">{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    LANGUAGES.map(l => (
                      <tr key={l.code} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="table-cell"><Skeleton /></td>
                        {NAMESPACES.map(n => <td key={n} className="table-cell"><Skeleton /></td>)}
                      </tr>
                    ))
                  ) : (
                    LANGUAGES.map(l => (
                      <tr key={l.code} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <code className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                              {l.code}
                            </code>
                            <span className="text-sm font-semibold text-theme">{l.name}</span>
                          </div>
                        </td>
                        {NAMESPACES.map(n => {
                          const cell = matrix[l.code]?.[n];
                          const pct = cell?.pct ?? 0;
                          const c = pctColor(pct);
                          return (
                            <td key={n} className="table-cell text-center">
                              <button
                                onClick={() => handleCellClick(l.code, n)}
                                className="mx-auto rounded-lg px-3 py-2 text-center transition-all duration-200 min-w-[72px]"
                                style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                                title={`${cell?.count ?? 0}/${cell?.total ?? 0} translated`}
                              >
                                <div className="text-sm font-bold">{pct}%</div>
                                <div className="text-[9px] opacity-70">{cell?.count ?? 0}/{cell?.total ?? 0}</div>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Missing translations card */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <AlertTriangle size={15} style={{ color: '#fbbf24' }} />
              <span className="font-bold text-theme text-sm">Top Missing Translations</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                {missing.length}
              </span>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
            ) : missing.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>All translations are complete!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Key</th>
                      <th className="table-header">Namespace</th>
                      <th className="table-header">Missing In</th>
                      <th className="table-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.slice(0, 10).map((item, i) => (
                      <tr key={i} className="table-row">
                        <td className="table-cell">
                          <code className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                            {item.key}
                          </code>
                        </td>
                        <td className="table-cell">
                          <span className="badge badge-blue">{item.namespace}</span>
                        </td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-1">
                            {item.missingIn.map(lang => (
                              <span key={lang} className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                                {lang}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="table-cell">
                          <button
                            onClick={() => router.push(`/translations/workspace?key=${encodeURIComponent(item.key)}&namespace=${item.namespace}`)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-200"
                            style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                            Translate
                          </button>
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
    </div>
  );
}

// Mock data for when API is not available
function generateMockMatrix(): CoverageMatrix {
  const matrix: CoverageMatrix = {};
  LANGUAGES.forEach(l => {
    matrix[l.code] = {};
    NAMESPACES.forEach(n => {
      const total = Math.floor(Math.random() * 200) + 50;
      const count = l.code === 'en' ? total : Math.floor(total * Math.random());
      matrix[l.code][n] = { pct: Math.round((count / total) * 100), count, total };
    });
  });
  return matrix;
}

function generateMockMissing(): MissingItem[] {
  return [
    { key: 'verse.bhagavad_gita.18.66', namespace: 'Verses', missingIn: ['ta', 'kn', 'bn'] },
    { key: 'sampraday.vaishnavism.description', namespace: 'Sampradayas', missingIn: ['sa', 'te', 'mr'] },
    { key: 'ui.home.hero_title', namespace: 'UI', missingIn: ['bn', 'gu'] },
    { key: 'mantra.gayatri.meaning', namespace: 'Mantras', missingIn: ['hi', 'ta', 'kn'] },
    { key: 'book.ramayana.synopsis', namespace: 'Books', missingIn: ['te', 'mr', 'bn'] },
  ];
}
